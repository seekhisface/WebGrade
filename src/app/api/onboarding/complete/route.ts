export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/onboarding/complete
 * Saves the remaining onboarding form data after all steps are done.
 * The site already exists (created by /api/onboarding/create-site).
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
  const {
    siteId,
    businessDescription,
    targetAudience,
    primaryValueProp,
    competitorUrls,
    monthlyAdSpend,
    averageOrderValue,
    leadToWinRate,
    conversionRate,
    ga4Connected,
    gscConnected,
    dataScenario,
  } = body;

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  // Verify this site belongs to the current user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { orgMemberships: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const orgIds = user.orgMemberships.map(m => m.orgId);
  const site = await prisma.site.findFirst({
    where: { id: siteId, orgId: { in: orgIds } },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found or unauthorized' }, { status: 404 });
  }

  // Update the onboarding record with remaining form data
  await prisma.siteOnboarding.upsert({
    where: { siteId },
    create: {
      siteId,
      businessDescription: businessDescription || null,
      targetAudience: targetAudience || null,
      primaryValueProp: primaryValueProp || null,
      competitorUrls: (competitorUrls ?? []).filter(Boolean),
      monthlyAdSpend: monthlyAdSpend ? parseFloat(monthlyAdSpend) : null,
      averageOrderValue: averageOrderValue ? parseFloat(averageOrderValue) : null,
      leadToWinRate: leadToWinRate ? parseFloat(leadToWinRate) / 100 : null,
      conversionRate: conversionRate ? parseFloat(conversionRate) / 100 : null,
      isComplete: true,
      completedAt: new Date(),
      completedSteps: [1, 2, 3, 4, 5],
    },
    update: {
      businessDescription: businessDescription || null,
      targetAudience: targetAudience || null,
      primaryValueProp: primaryValueProp || null,
      competitorUrls: (competitorUrls ?? []).filter(Boolean),
      monthlyAdSpend: monthlyAdSpend ? parseFloat(monthlyAdSpend) : null,
      averageOrderValue: averageOrderValue ? parseFloat(averageOrderValue) : null,
      leadToWinRate: leadToWinRate ? parseFloat(leadToWinRate) / 100 : null,
      conversionRate: conversionRate ? parseFloat(conversionRate) / 100 : null,
      isComplete: true,
      completedAt: new Date(),
      completedSteps: [1, 2, 3, 4, 5],
    },
  });

  return NextResponse.json({ ok: true, siteId });
}
