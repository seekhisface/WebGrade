// POST /api/detect-ctas
// Crawls a site URL and returns detected CTAs, forms, and conversion actions.
// Used by onboarding to suggest conversion goals.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { detectCtas } from '@/lib/seo/crawler';

export const runtime = 'nodejs';
export const maxDuration = 30; // CTA detection can take a few seconds

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  try {
    const ctas = await detectCtas(url, 8);
    return NextResponse.json({
      ctas,
      summary: {
        total: ctas.length,
        forms: ctas.filter(c => c.type === 'form').length,
        buttons: ctas.filter(c => c.type === 'button').length,
        links: ctas.filter(c => c.type === 'link').length,
        highConfidence: ctas.filter(c => c.confidence === 'high').length,
      },
    });
  } catch (err) {
    console.error('CTA detection error:', err);
    return NextResponse.json({ error: 'Failed to detect CTAs' }, { status: 500 });
  }
}
