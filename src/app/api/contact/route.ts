// src/app/api/contact/route.ts
// POST /api/contact — captures lead inquiry (email, phone, message).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  website: z.string().url().optional().or(z.literal('')),
  message: z.string().max(2000).optional(),
  source: z.string().max(100).optional(), // e.g. "marketing_page", "pricing", "footer"
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { name, email, phone, company, website, message, source } = parsed.data;

    // Store in ContactInquiry table
    const inquiry = await prisma.contactInquiry.create({
      data: { name, email, phone, company, website, message, source },
    });

    // Send notification email via Resend (non-blocking)
    try {
      const { sendEmail } = await import('@/lib/email/sender');
      await sendEmail({
        to: process.env.EMAIL_FROM ?? 'team@webgrade.io',
        subject: `New inquiry from ${name} (${company ?? 'No company'})`,
        html: `
          <h2>New WebGrade Inquiry</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          ${website ? `<p><strong>Website:</strong> ${website}</p>` : ''}
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <p><strong>Source:</strong> ${source ?? 'unknown'}</p>
        `,
      });
    } catch { /* email send failed — non-fatal */ }

    return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
