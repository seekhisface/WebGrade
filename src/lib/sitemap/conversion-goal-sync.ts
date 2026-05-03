/**
 * Two-way sync between SiteCta.status and the ConversionGoal table.
 *
 * Marking a CTA as TRACKED on the Site Map page should be treated by the rest
 * of the app as "the user has set a conversion goal." This module keeps the
 * ConversionGoal records in lockstep with TRACKED CTAs so the dashboard's
 * "Set Conversion Goal" prompt clears, the report's hasRevenueData / Revenue
 * at Risk states evaluate correctly, etc.
 *
 * Behavior:
 *   TRACKED → upsert ConversionGoal (deduped by url+name). Also fills in the
 *             legacy SiteOnboarding.conversionGoalUrl singular field if empty.
 *   not TRACKED (was TRACKED) → mark the matching ConversionGoal inactive.
 *
 * Soft-delete (isActive=false) is intentional — preserves history for any
 * reports that referenced it. The dashboard checks isActive=true.
 */

import { prisma } from '@/lib/db/client';

interface SyncInput {
  siteId: string;
  ctaText: string;
  ctaHref: string;        // empty string = button with JS handler, no destination URL
  pages: string[];        // pages where the CTA appears, used as fallback URL
  previousStatus: 'TRACKED' | 'SUGGESTED' | 'IGNORED';
  newStatus: 'TRACKED' | 'SUGGESTED' | 'IGNORED';
}

export async function syncCtaToConversionGoal(input: SyncInput): Promise<void> {
  const { siteId, ctaText, ctaHref, pages, previousStatus, newStatus } = input;

  // No-op when status didn't actually change to/from TRACKED
  if (previousStatus === newStatus) return;

  // Resolve a URL for the conversion goal record. ctaHref preferred; fall back
  // to the first page where this CTA appears (button with no href but on /pricing
  // → goal URL is /pricing). Skip sync entirely if no usable URL is available.
  const goalUrl = ctaHref || pages[0] || null;
  if (!goalUrl) return;

  const goalName = `CTA: ${ctaText.slice(0, 60)}`;

  if (newStatus === 'TRACKED') {
    // Find an existing ConversionGoal record for this URL (not unique-keyed in
    // schema, so we look up manually). Reuse if present, else create.
    const existing = await prisma.conversionGoal.findFirst({
      where: { siteId, url: goalUrl },
    });

    if (existing) {
      // Reactivate if it was previously deactivated; refresh the name in case
      // the CTA text was edited.
      if (!existing.isActive || existing.name !== goalName) {
        await prisma.conversionGoal.update({
          where: { id: existing.id },
          data: { isActive: true, name: goalName },
        });
      }
    } else {
      await prisma.conversionGoal.create({
        data: { siteId, name: goalName, url: goalUrl, isActive: true },
      });
    }

    // Also seed the legacy SiteOnboarding.conversionGoalUrl singular field if
    // it's empty — keeps any older code paths that read that field happy.
    const onboarding = await prisma.siteOnboarding.findUnique({
      where: { siteId },
      select: { conversionGoalUrl: true },
    });
    if (onboarding && !onboarding.conversionGoalUrl) {
      await prisma.siteOnboarding.update({
        where: { siteId },
        data: { conversionGoalUrl: goalUrl, conversionGoalName: goalName },
      });
    }
  } else if (previousStatus === 'TRACKED') {
    // Transitioning OUT of TRACKED → soft-delete the ConversionGoal record.
    // Soft delete (isActive=false) preserves history without confusing queries.
    await prisma.conversionGoal.updateMany({
      where: { siteId, url: goalUrl, name: goalName },
      data: { isActive: false },
    });
  }
}
