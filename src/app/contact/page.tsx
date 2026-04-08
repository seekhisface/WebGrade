'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', website: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'contact_page' }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-[#0c4a6e] mb-2">Message sent!</h1>
          <p className="text-sm text-[#64748b] mb-6">We&apos;ll get back to you within one business day. In the meantime, you can explore WebGrade or book a walkthrough.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/marketing" className="px-5 py-2.5 bg-[#0c4a6e] text-white text-sm font-semibold rounded-xl hover:bg-[#075985] transition-colors">
              Back to WebGrade
            </Link>
            <Link href="/onboarding" className="px-5 py-2.5 bg-white border border-[#bae6fd] text-[#0c4a6e] text-sm font-semibold rounded-xl hover:bg-[#f0f9ff] transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-6 py-10 text-center">
        <Link href="/" className="inline-block mb-4">
          <Image src="/logos/webgrade_logo_dark.svg" alt="WebGrade" width={200} height={40} className="h-8 w-auto mx-auto" />
        </Link>
        <h1 className="text-3xl font-black text-white mb-2">Have questions?</h1>
        <p className="text-sm text-sky-300 max-w-lg mx-auto">We&apos;re here to help. Tell us about your website and what you&apos;re looking for, and we&apos;ll get back to you within one business day.</p>
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="bg-white border border-[#bae6fd] rounded-2xl p-8 shadow-sm space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent"
                placeholder="Your name" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Company</label>
              <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent"
                placeholder="Company name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent"
                placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent"
                placeholder="(555) 123-4567" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Your website</label>
            <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent"
              placeholder="https://yoursite.com" />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">How can we help?</label>
            <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent resize-none"
              placeholder="Tell us about your site, your goals, or any questions you have..." />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}

          <button type="submit" disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-[#0c4a6e] hover:bg-[#075985] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50">
            {sending ? 'Sending...' : 'Send message'}
            {!sending && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </button>

          <p className="text-xs text-[#94a3b8] text-center">We&apos;ll never share your information. Read our <Link href="/privacy" className="text-[#0891b2] hover:underline">Privacy Policy</Link>.</p>
        </form>

        {/* Alternative CTAs */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="bg-white border border-[#bae6fd] rounded-xl p-5 text-center">
            <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Ready to start?</p>
            <Link href="/onboarding" className="text-sm text-[#0891b2] font-semibold hover:underline">Create your account →</Link>
          </div>
          <div className="bg-white border border-[#bae6fd] rounded-xl p-5 text-center">
            <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Want a walkthrough?</p>
            <Link href="/marketing#pricing" className="text-sm text-[#0891b2] font-semibold hover:underline">Book a demo →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
