export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/onboarding/create-site
 * Creates a site record early in onboarding (after step 1) so we have
 * a siteId available for OAuth flows (GA4, GSC) in later steps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { siteUrl, siteName, conversionGoalUrl, conversionGoalName, dataScenario } = body;

  if (!siteUrl || !siteName) {
    return NextResponse.json({ error: 'siteUrl and siteName are required' }, { status: 400 });
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { orgMemberships: { include: { org: true }, take: 1 } },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Find or create org
  let orgId: string;
  if (user.orgMemberships.length > 0) {
    orgId = user.orgMemberships[0].orgId;
  } else {
    const org = await prisma.organization.create({
      data: {
        name: siteName,
        slug: slugify(siteName),
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });
    orgId = org.id;
  }

  // Extract domain
  let domain: string;
  try {
    domain = new URL(siteUrl).hostname.replace('www.', '');
  } catch {
    return NextResponse.json({ error: 'Invalid siteUrl' }, { status: 400 });
  }

  // Create the site with a minimal onboarding record
  const site = await prisma.site.create({
    data: {
      orgId,
      name: siteName,
      domain,
      url: siteUrl,
      hasInterimReport: true,
      hasWebWatch: true,
      hasWebOpp: true,
      onboarding: {
        create: {
          conversionGoalUrl: conversionGoalUrl || null,
          conversionGoalName: conversionGoalName || null,
          isComplete: false,
        },
      },
    },
  });

  // Initialize default alert settings
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
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}
