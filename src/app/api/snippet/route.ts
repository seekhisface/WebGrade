// src/app/api/snippet/route.ts
// Serves the WebGrade tracking snippet with per-site placeholders substituted.
//
// GET /api/snippet?id=SNIPPET_ID
//
// Customers embed: <script src="https://app.webgrade.io/api/snippet?id=abc123" async></script>

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

// Cache the raw snippet template in memory after first read
let snippetTemplate: string | null = null;

async function getSnippetTemplate(): Promise<string> {
  if (snippetTemplate) return snippetTemplate;
  const filePath = join(process.cwd(), 'public', 'snippet', 'webgrade.js');
  snippetTemplate = await readFile(filePath, 'utf-8');
  return snippetTemplate;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const snippetId = searchParams.get('id');

  if (!snippetId) {
    return new NextResponse('// WebGrade: missing snippet ID', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  // Look up the site by snippet ID
  const site = await prisma.site.findFirst({
    where: { snippetId, isActive: true },
    select: { id: true, snippetId: true },
  });

  if (!site) {
    return new NextResponse('// WebGrade: invalid snippet ID', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  // Build the ingest URL from the request origin
  const origin = req.headers.get('x-forwarded-proto')
    ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('host')}`
    : new URL(req.url).origin;
  const ingestUrl = `${origin}/api/ingest`;

  // Read template and substitute placeholders
  const template = await getSnippetTemplate();
  const js = template
    .replace('{{SNIPPET_ID}}', site.snippetId)
    .replace('{{INGEST_URL}}', ingestUrl);

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-WebGrade-Snippet': '1.0.0',
    },
  });
}
