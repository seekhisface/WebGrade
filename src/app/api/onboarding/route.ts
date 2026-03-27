export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/onboarding
 * Creates a new site + onboarding record from the onboarding form.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

const OnboardingSchema = z.object({
  siteUrl: z.string().url(),
  siteName: z.string().min(1),
  conversionGoalUrl: z.string().url(),
  conversionGoalName: z.string().min(1),
  businessDescription: z.string().optional(),
  targetAudience: z.string().optional(),
  primaryValueProp: z.string().optional(),
  competitorUrls: z.array(z.string()).optional(),
  ga4Connected: z.boolean().optional(),
  monthlyAdSpend: z.string().optional(),
  averageOrderValue: z.string().optional(),
  leadToWinRate: z.string().optional(),
  conversionRate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // Find or create org for this user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { orgMemberships: { include: { org: true }, take: 1 } }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let orgId: string;
  if (user.orgMemberships.length > 0) {
    orgId = user.orgMemberships[0].orgId;
  } else {
    // Create org for new user
    const org = await prisma.organization.create({
      data: {
        name: data.siteName,
        slug: slugify(data.siteName),
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          }
        }
      }
    });
    orgId = org.id;
  }

  // Extract domain from URL
  const domain = new URL(data.siteUrl).hostname.replace('www.', '');

  // Create the site
  const site = await prisma.site.create({
    data: {
      orgId,
      name: data.siteName,
      domain,
      url: data.siteUrl,
      hasInterimReport: true,
      hasWebWatch: true,
      hasWebOpp: true,
      onboarding: {
        create: {
          conversionGoalUrl: data.conversionGoalUrl,
          conversionGoalName: data.conversionGoalName,
          businessDescription: data.businessDescription,
          targetAudience: data.targetAudience,
          primaryValueProp: data.primaryValueProp,
          competitorUrls: (data.competitorUrls ?? []).filter(Boolean),
          monthlyAdSpend: data.monthlyAdSpend ? parseFloat(data.monthlyAdSpend) : null,
          averageOrderValue: data.averageOrderValue ? parseFloat(data.averageOrderValue) : null,
          leadToWinRate: data.leadToWinRate ? parseFloat(data.leadToWinRate) / 100 : null,
          conversionRate: data.conversionRate ? parseFloat(data.conversionRate) / 100 : null,
          isComplete: true,
          completedAt: new Date(),
          completedSteps: [1, 2, 3, ...(data.ga4Connected ? [4] : []), ...(data.monthlyAdSpend ? [5] : [])],
        }
      }
    }
  });

  // Initialize default alert settings for this site
  await initializeAlertSettings(site.id);

  return NextResponse.json({ ok: true, siteId: site.id });
}

async function initializeAlertSettings(siteId: string) {
  const defaultAlerts = [
    { alertType: 'CONVERSION_DROP', severity: 'HIGH', emailEnabled: true },
    { alertType: 'BOUNCE_RATE_SPIKE', severity: 'HIGH', emailEnabled: true },
    { alertType: 'WASTED_SPEND_DETECTED', severity: 'CRITICAL', emailEnabled: true },
    { alertType: 'SNIPPET_FIRING_STOPPED', severity: 'CRITICAL', emailEnabled: true },
    { alertType: 'SEO_REGRESSION', severity: 'HIGH', emailEnabled: true },
    { alertType: 'NEW_HIGH_VALUE_OPPORTUNITY', severity: 'MEDIUM', emailEnabled: true },
  ] as const;

  await prisma.alertSetting.createMany({
    data: defaultAlerts.map(a => ({
      siteId,
      alertType: a.alertType,
      severity: a.severity,
      emailEnabled: a.emailEnabled,
      isEnabled: true,
    })),
    skipDuplicates: true,
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) + '-' + Math.random().toString(36).slice(2, 6);
}
