export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { fetchKeywordData, fetchDailyTraffic } from '@/lib/gsc/client';

// POST /api/gsc/sync — sync Search Console data for a site
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      gscConnected: true,
      gscPropertyUrl: true,
      gscConnectedByUserId: true,
      gscLastSyncAt: true,
    },
  });

  if (!site?.gscConnected || !site.gscPropertyUrl || !site.gscConnectedByUserId) {
    return NextResponse.json({ error: 'GSC not connected for this site' }, { status: 400 });
  }

  // Sync window: last sync (or 90 days ago) to 3 days ago (GSC data delay)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = site.gscLastSyncAt
    ? new Date(site.gscLastSyncAt)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  if (startStr >= endStr) {
    await prisma.site.update({ where: { id: siteId }, data: { gscLastSyncAt: new Date() } });
    return NextResponse.json({ success: true, message: 'Already up to date', daysImported: 0, keywordsImported: 0 });
  }

  try {
    // Fetch data from GSC API
    const [dailyTraffic, keywordRows] = await Promise.all([
      fetchDailyTraffic(site.gscConnectedByUserId, site.gscPropertyUrl, startStr, endStr),
      fetchKeywordData(site.gscConnectedByUserId, site.gscPropertyUrl, startStr, endStr),
    ]);

    // Write traffic snapshots — upsert by (siteId, date)
    if (dailyTraffic.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const day of dailyTraffic) {
          await tx.seoTrafficSnapshot.upsert({
            where: { siteId_date: { siteId, date: new Date(day.date) } },
            create: {
              siteId,
              date: new Date(day.date),
              clicks: day.clicks,
              impressions: day.impressions,
              ctr: day.ctr,
              avgPosition: day.position,
              organicSessions: day.clicks,
              totalSessions: day.clicks,
              organicPct: 100,
            },
            update: {
              clicks: day.clicks,
              impressions: day.impressions,
              ctr: day.ctr,
              avgPosition: day.position,
              organicSessions: day.clicks,
            },
          });
        }
      });
    }

    // Write keyword rankings — upsert by (siteId, keyword, date)
    // Batch in chunks of 500 to avoid oversized transactions
    const CHUNK_SIZE = 500;
    for (let i = 0; i < keywordRows.length; i += CHUNK_SIZE) {
      const chunk = keywordRows.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const kw of chunk) {
          await tx.seoKeywordRanking.upsert({
            where: {
              siteId_keyword_date: { siteId, keyword: kw.keyword, date: new Date(kw.date) },
            },
            create: {
              siteId,
              date: new Date(kw.date),
              keyword: kw.keyword,
              position: kw.position,
              clicks: kw.clicks,
              impressions: kw.impressions,
              ctr: kw.ctr,
            },
            update: {
              position: kw.position,
              clicks: kw.clicks,
              impressions: kw.impressions,
              ctr: kw.ctr,
            },
          });
        }
      });
    }

    // Compute keyword bucket counts for the latest day
    const latestDate = dailyTraffic.length > 0
      ? dailyTraffic[dailyTraffic.length - 1].date
      : endStr;

    const latestKeywords = keywordRows.filter(kw => kw.date === latestDate);
    const keywordsTop3 = latestKeywords.filter(kw => kw.position <= 3).length;
    const keywordsTop10 = latestKeywords.filter(kw => kw.position <= 10).length;
    const keywordsTop30 = latestKeywords.filter(kw => kw.position <= 30).length;

    // Update the latest traffic snapshot with keyword counts
    if (latestDate) {
      await prisma.seoTrafficSnapshot.update({
        where: { siteId_date: { siteId, date: new Date(latestDate) } },
        data: {
          keywordsTop3,
          keywordsTop10,
          keywordsTop30,
          keywordsTotal: latestKeywords.length,
        },
      }).catch(() => {}); // Non-fatal if snapshot doesn't exist
    }

    // Update last sync timestamp
    await prisma.site.update({
      where: { id: siteId },
      data: { gscLastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      daysImported: dailyTraffic.length,
      keywordsImported: keywordRows.length,
      dateRange: { start: startStr, end: endStr },
    });
  } catch (err) {
    console.error('[gsc/sync] Sync failed:', err);
    return NextResponse.json(
      { error: 'Sync failed — Google access may have expired' },
      { status: 500 },
    );
  }
}
