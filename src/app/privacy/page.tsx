// Privacy policy page — linked from the marketing footer.
// Content reflects the actual technical practices documented in CLAUDE.md:
//   DL-01: IPs SHA-256 hashed at ingest, never stored raw
//   DL-02: Consent-aware tracking (OneTrust / Cookiebot / Google Consent Mode v2)
//   DL-04: 90-day raw event retention with automatic deletion via Inngest
// Update the LAST_UPDATED constant when this page is materially changed.

import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Privacy Policy — WebGrade',
  description:
    'How WebGrade handles visitor data: IP anonymization, consent gating, 90-day retention, and the rights you have over your data.',
};

const LAST_UPDATED = 'May 7, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f0f9ff] text-slate-800">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/marketing" className="flex items-center">
            <Image
              src="/logos/webgrade_logo_light.svg"
              alt="WebGrade"
              width={220}
              height={42}
              className="h-10 w-auto"
            />
          </Link>
          <Link
            href="/marketing"
            className="text-sm text-slate-600 hover:text-[#0c4a6e] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wider text-[#4a9ebe] mb-2">
            Legal
          </p>
          <h1 className="text-4xl font-bold text-[#082f49] mb-3">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed">
          {/* TL;DR */}
          <section className="bg-white border border-sky-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#082f49] mb-3">Summary</h2>
            <ul className="space-y-2 text-slate-700">
              <li>
                <strong>We do not store raw IP addresses.</strong> Every IP is
                SHA-256 hashed at the moment of ingest and discarded.
              </li>
              <li>
                <strong>We do not set advertising cookies.</strong> Our tracker
                respects OneTrust, Cookiebot, and Google Consent Mode v2.
              </li>
              <li>
                <strong>Raw event data is deleted after 90 days.</strong>{' '}
                Aggregated insights are retained.
              </li>
              <li>
                <strong>You can request deletion or export</strong> at any time
                by emailing{' '}
                <a
                  href="mailto:privacy@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  privacy@webgrade.io
                </a>
                .
              </li>
            </ul>
          </section>

          {/* Who we are */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              1. Who we are
            </h2>
            <p>
              WebGrade is a website intelligence platform operated by Greater
              Sum Ventures. We help website operators (our customers) understand
              how visitors interact with their sites so they can fix usability,
              SEO, and conversion issues. This policy covers two groups of
              people:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>
                <strong>Customers</strong> — businesses that sign up for a
                WebGrade account.
              </li>
              <li>
                <strong>End visitors</strong> — people who visit websites that
                have installed the WebGrade tracking snippet.
              </li>
            </ul>
          </section>

          {/* What we collect */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              2. What we collect from website visitors
            </h2>
            <p className="mb-3">
              When a website you visit has installed our tracking snippet, we
              receive a stream of behavioral events about your session. We
              collect:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pages viewed and the order you viewed them in</li>
              <li>
                Behavioral signals: clicks, scroll depth, hesitation, rage
                clicks, form focus, exit intent
              </li>
              <li>
                Approximate location (country and region) derived from your IP
                <em> before</em> the IP is hashed
              </li>
              <li>
                Device, browser, and operating system as reported by your
                browser
              </li>
              <li>
                A privacy-preserving fingerprint (HMAC-SHA256 of IP + user
                agent + screen + timezone, with a salt that rotates daily)
              </li>
              <li>
                Referrer and UTM/click-ID parameters present in the page URL
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect names, email addresses, phone
              numbers, payment details, or the contents of forms you fill in,
              unless a customer&apos;s site explicitly chooses to mark a
              specific event as a conversion that includes a form ID.
            </p>
          </section>

          {/* IP handling */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              3. How we handle IP addresses
            </h2>
            <p>
              IP addresses are sensitive because they can identify individual
              people. We treat them accordingly:
            </p>
            <ol className="list-decimal pl-6 mt-3 space-y-2">
              <li>
                Your IP arrives at our ingestion endpoint inside the HTTP
                request.
              </li>
              <li>
                Before any database write, the IP is hashed with SHA-256
                combined with the customer&apos;s site identifier and a fixed
                application salt. The result is a 64-character string with no
                practical reverse path to the original IP.
              </li>
              <li>
                The raw IP is discarded. Only the hash, the country, and the
                region are stored.
              </li>
              <li>
                The hashing rule is applied universally — there is no code path
                in our system that writes a raw IP to long-term storage.
              </li>
            </ol>
          </section>

          {/* Consent */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              4. Consent
            </h2>
            <p className="mb-3">
              Our tracking snippet is consent-aware. Before initializing, it
              checks for signals from the consent management platforms
              installed on the page:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>OneTrust (category C0002 — performance cookies)</li>
              <li>Cookiebot</li>
              <li>Google Consent Mode v2 (analytics_storage)</li>
            </ul>
            <p className="mt-3">
              If consent has not been granted, the snippet runs in{' '}
              <strong>anonymous mode</strong>: nothing is sent to our servers
              and no persistent identifiers are written. A best-effort
              session-only record is held in <code>sessionStorage</code> and
              discarded when the tab closes.
            </p>
            <p className="mt-3">
              When consent is granted, we additionally forward a subset of
              events to PostHog for product analytics. We do not forward
              events to advertising networks.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              5. Cookies and local storage
            </h2>
            <p>
              We use the smallest set of identifiers that lets us correctly
              attribute events to a session:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>
                <strong>A first-party session ID</strong> (placed in{' '}
                <code>localStorage</code> when consent is granted, otherwise
                <code> sessionStorage</code>) used to group events into one
                visit
              </li>
              <li>
                <strong>An NextAuth session cookie</strong> (HTTP-only,
                Secure) for customers logged into the WebGrade dashboard
              </li>
            </ul>
            <p className="mt-3">
              We do not set third-party cookies, advertising cookies, or
              cross-site tracking cookies.
            </p>
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              6. Data retention
            </h2>
            <p>
              <strong>Raw behavioral events</strong> (the per-event records
              described in section 2) are deleted automatically after 90 days
              by a daily background job. Each deletion run is logged for audit.
            </p>
            <p className="mt-3">
              <strong>Aggregated and derived data</strong> — site scores,
              monthly summaries, AI-generated reports, and the totals that
              appear in customer dashboards — is retained for the life of the
              customer account so historical comparisons remain meaningful.
              Derived data does not contain raw IPs or fingerprints.
            </p>
            <p className="mt-3">
              When a customer cancels their account, all of their raw and
              derived data is permanently deleted within 30 days, except where
              we are required by law to retain financial records.
            </p>
          </section>

          {/* Sub-processors */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              7. Sub-processors
            </h2>
            <p>WebGrade relies on the following providers:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-sky-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">
                      Provider
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">
                      Purpose
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">
                      Region
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 py-2">Vercel</td>
                    <td className="px-3 py-2">Application hosting</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Supabase (PostgreSQL)</td>
                    <td className="px-3 py-2">Primary database</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Anthropic</td>
                    <td className="px-3 py-2">
                      AI-generated explanations and reports (no raw visitor
                      data is sent)
                    </td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">PostHog</td>
                    <td className="px-3 py-2">
                      Product analytics for consenting visitors
                    </td>
                    <td className="px-3 py-2">United States / EU</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Resend</td>
                    <td className="px-3 py-2">Transactional and alert email</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Inngest</td>
                    <td className="px-3 py-2">Background job orchestration</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">DataForSEO</td>
                    <td className="px-3 py-2">
                      Keyword and ranking data for the WebOpp module
                    </td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Your rights */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              8. Your rights
            </h2>
            <p>
              Depending on where you live (GDPR in the EU/UK, CCPA in
              California, and similar laws elsewhere), you may have the right
              to:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent at any time</li>
              <li>Lodge a complaint with your local data protection authority</li>
            </ul>
            <p className="mt-3">
              Because we do not store raw IPs or directly-identifying
              information about visitors, we may not be able to locate
              individual records without additional context (such as the
              session ID assigned by the website you visited). To make a
              request, email{' '}
              <a
                href="mailto:privacy@webgrade.io"
                className="text-[#0c4a6e] underline"
              >
                privacy@webgrade.io
              </a>
              .
            </p>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              9. Security
            </h2>
            <p>
              All data is transmitted over TLS. Production database access is
              restricted to application service accounts. Customer passwords
              are stored as bcrypt hashes; sign-in via Google OAuth never
              exposes your Google password to us. We rate-limit our public
              ingestion API and filter known bot traffic before it reaches
              storage.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              10. Children
            </h2>
            <p>
              WebGrade is not directed at children under 16. We do not
              knowingly collect data from children. If you believe a child has
              been tracked through one of our customer&apos;s sites, contact
              us and we will work with the customer to remove the data.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              11. Changes to this policy
            </h2>
            <p>
              We will update the date at the top of this page whenever we make
              material changes. For significant changes we will also notify
              customers by email.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              12. Contact us
            </h2>
            <p>
              Questions about this policy or about how your data is handled:
            </p>
            <p className="mt-2">
              <a
                href="mailto:privacy@webgrade.io"
                className="text-[#0c4a6e] underline"
              >
                privacy@webgrade.io
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#082f49] py-10 mt-16">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Image
            src="/logos/webgrade_logo_dark.svg"
            alt="WebGrade"
            width={300}
            height={56}
            className="h-14 w-auto"
          />
          <div className="flex flex-wrap items-center gap-6 text-xs text-sky-400">
            <Link href="/marketing" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-xs text-sky-600">© 2026 WebGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
