// Terms of Service — linked from the marketing footer alongside /privacy.
// Pairs with /privacy: this file governs the contractual relationship between
// WebGrade and customers; /privacy governs visitor data handling. Bump
// LAST_UPDATED when material changes ship and notify customers per section 14.

import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Terms of Service — WebGrade',
  description:
    'The agreement that governs your use of WebGrade — accounts, acceptable use, subscriptions, AI-generated insights, liability, and termination.',
};

const LAST_UPDATED = 'May 7, 2026';

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-[#082f49] mb-3">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed">
          {/* Summary */}
          <section className="bg-white border border-sky-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#082f49] mb-3">Summary</h2>
            <ul className="space-y-2 text-slate-700">
              <li>
                <strong>You install our snippet on sites you own</strong> — and
                you are responsible for getting visitor consent on those sites.
              </li>
              <li>
                <strong>Your data stays yours.</strong> We use it only to
                deliver the service, and we delete it when you cancel.
              </li>
              <li>
                <strong>AI-generated insights are guidance, not advice.</strong>{' '}
                Verify before you act on them.
              </li>
              <li>
                <strong>Cancel anytime.</strong> Subscriptions don&apos;t
                auto-renew silently — billing terms are spelled out at
                checkout.
              </li>
            </ul>
          </section>

          {/* 1. Agreement */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              1. The agreement
            </h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) form a binding
              agreement between you (&quot;you&quot; or &quot;Customer&quot;)
              and WebGrade, a product of Greater Sum Ventures
              (&quot;WebGrade,&quot; &quot;we,&quot; &quot;us&quot;). By
              creating an account, installing our tracking snippet, or using
              any part of the service, you agree to these Terms and to our{' '}
              <Link href="/privacy" className="text-[#0c4a6e] underline">
                Privacy Policy
              </Link>
              . If you are agreeing on behalf of a company, you represent that
              you have authority to bind that company.
            </p>
          </section>

          {/* 2. The service */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              2. What the service does
            </h2>
            <p>WebGrade is a website intelligence platform with three modules:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>
                <strong>WebAudit&trade;</strong> — a one-time 45-day forensic
                audit of a website
              </li>
              <li>
                <strong>WebWatch&trade;</strong> — an always-on monthly
                monitoring subscription
              </li>
              <li>
                <strong>WebOpp&trade;</strong> — market and keyword
                intelligence comparing your site to competitors
              </li>
            </ul>
            <p className="mt-3">
              The service includes a JavaScript tracking snippet, a customer
              dashboard, scheduled reports, alerts, and AI-generated
              explanations and recommendations. Specific features available to
              you depend on the plan you select at checkout.
            </p>
          </section>

          {/* 3. Eligibility & accounts */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              3. Accounts and eligibility
            </h2>
            <p>
              You must be at least 18 years old and able to enter a binding
              contract in your jurisdiction. You are responsible for keeping
              your login credentials secure and for all activity that occurs
              under your account. Notify us promptly at{' '}
              <a
                href="mailto:support@webgrade.io"
                className="text-[#0c4a6e] underline"
              >
                support@webgrade.io
              </a>{' '}
              if you suspect unauthorized access.
            </p>
            <p className="mt-3">
              Accounts can have multiple users with different roles (Owner,
              Admin, Viewer). The Owner is responsible for what their team
              does inside the account.
            </p>
          </section>

          {/* 4. Customer responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              4. Your responsibilities
            </h2>
            <p>You agree that:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                You will only install the WebGrade snippet on websites you own
                or have explicit written permission to track.
              </li>
              <li>
                You are responsible for displaying a compliant cookie/consent
                banner on your site and configuring your consent management
                platform (OneTrust, Cookiebot, Google Consent Mode v2, or
                similar) so that visitor consent is correctly signaled to our
                snippet.
              </li>
              <li>
                You will not configure WebGrade to capture personally
                identifiable information (names, emails, phone numbers,
                payment data, government IDs, health information, etc.) inside
                events, conversion metadata, or form selectors.
              </li>
              <li>
                You will publish a privacy policy on your own site that
                discloses the use of behavioral analytics and references the
                categories of data described in our{' '}
                <Link href="/privacy" className="text-[#0c4a6e] underline">
                  Privacy Policy
                </Link>
                .
              </li>
              <li>
                You will keep your billing information current and pay any
                fees when due.
              </li>
            </ul>
          </section>

          {/* 5. Acceptable use */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              5. Acceptable use
            </h2>
            <p>You will not, and will not allow anyone else to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                Reverse-engineer, decompile, or attempt to extract the source
                code of the service (other than the public tracking snippet,
                which is intentionally readable)
              </li>
              <li>
                Resell, sublicense, or white-label the service without a
                separate written agreement with us
              </li>
              <li>
                Use the service to track minors under 16, or to track visitors
                in jurisdictions where doing so is unlawful
              </li>
              <li>
                Send abusive volumes of traffic to our ingestion API or
                attempt to circumvent rate limits, bot filtering, or our
                anti-abuse controls
              </li>
              <li>
                Use the service to build a competing product, or scrape our
                dashboards, reports, or AI outputs for that purpose
              </li>
              <li>
                Probe, scan, or test the vulnerability of the service except
                under a written authorization from us (see{' '}
                <a
                  href="mailto:security@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  security@webgrade.io
                </a>
                )
              </li>
              <li>
                Upload malware or use the service to facilitate illegal
                activity
              </li>
            </ul>
          </section>

          {/* 6. Data */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              6. Your data and our use of it
            </h2>
            <p>
              <strong>Customer Data</strong> means the behavioral events,
              configuration, integrations, and content you or your visitors
              submit to the service. As between you and WebGrade, Customer
              Data belongs to you.
            </p>
            <p className="mt-3">
              You grant us a worldwide, non-exclusive, royalty-free license to
              process Customer Data solely to:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Operate, secure, and improve the service for you</li>
              <li>
                Generate the dashboards, reports, alerts, and AI-generated
                outputs that the service exists to produce
              </li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We may use de-identified, aggregated metrics derived from
              Customer Data (for example, industry benchmarks across many
              sites) to improve our models and benchmarking. Aggregates never
              identify you, your visitors, or any individual site.
            </p>
            <p className="mt-3">
              How we collect, store, retain, and delete data is described in
              detail in our{' '}
              <Link href="/privacy" className="text-[#0c4a6e] underline">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms.
            </p>
          </section>

          {/* 7. AI outputs */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              7. AI-generated insights
            </h2>
            <p>
              Parts of the service generate explanations, recommendations, and
              reports using large language models (currently Anthropic
              Claude). These outputs:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>
                Are generated programmatically and may contain errors,
                omissions, or fabricated detail
              </li>
              <li>
                Are <strong>guidance, not professional advice</strong>. They
                are not legal, financial, medical, accounting, or engineering
                advice
              </li>
              <li>
                Should be reviewed before you act on them, especially when the
                action involves money, customers, or legal exposure
              </li>
            </ul>
            <p className="mt-3">
              We do not send raw visitor IPs or fingerprints to AI providers.
              We send the aggregated data and business context needed to
              produce the requested output.
            </p>
          </section>

          {/* 8. Subscriptions & billing */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              8. Subscriptions, billing, and cancellation
            </h2>
            <p>
              <strong>Plans.</strong> Plans, prices, and billing intervals are
              shown at checkout and on your account&apos;s billing page. Some
              plans (e.g. WebAudit) are one-time fees; others (e.g. WebWatch)
              recur monthly or annually until canceled.
            </p>
            <p className="mt-3">
              <strong>Renewals.</strong> Recurring subscriptions automatically
              renew at the end of each billing period at the then-current rate
              unless you cancel before renewal.
            </p>
            <p className="mt-3">
              <strong>Cancellation.</strong> You can cancel a recurring plan
              at any time from your account&apos;s billing page or by emailing{' '}
              <a
                href="mailto:billing@webgrade.io"
                className="text-[#0c4a6e] underline"
              >
                billing@webgrade.io
              </a>
              . Cancellation takes effect at the end of the current billing
              period; you keep access until then.
            </p>
            <p className="mt-3">
              <strong>Refunds.</strong> Fees are non-refundable except where
              required by law or where we explicitly offer a refund (for
              example, an unhappiness guarantee on a specific plan, which will
              be stated at checkout).
            </p>
            <p className="mt-3">
              <strong>Taxes.</strong> Prices exclude taxes. You are
              responsible for any sales, VAT, GST, or similar taxes that
              apply.
            </p>
            <p className="mt-3">
              <strong>Late payment.</strong> If a payment fails, we may
              suspend the service after reasonable notice. Repeated failure
              may result in account termination.
            </p>
          </section>

          {/* 9. IP */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              9. Intellectual property
            </h2>
            <p>
              The service, including its software, models, prompts,
              dashboards, and brand, is owned by WebGrade and our licensors
              and is protected by intellectual property laws. We grant you a
              limited, non-transferable, revocable license to use the service
              for your internal business purposes during your subscription.
            </p>
            <p className="mt-3">
              Feedback you give us about the service may be used by us
              without restriction, but we are not obligated to act on it.
            </p>
          </section>

          {/* 10. Confidentiality */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              10. Confidentiality
            </h2>
            <p>
              Each party will protect the other&apos;s confidential
              information using at least the same care it uses for its own
              confidential information of similar importance, and not less
              than reasonable care. Confidential information does not include
              information that is public, was already known, was independently
              developed, or is required to be disclosed by law.
            </p>
          </section>

          {/* 11. Disclaimers */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              11. Disclaimers
            </h2>
            <p className="uppercase text-xs tracking-wide text-slate-500 mb-3">
              Please read this section carefully.
            </p>
            <p>
              The service is provided <strong>&quot;as is&quot;</strong> and{' '}
              <strong>&quot;as available.&quot;</strong> To the maximum
              extent permitted by law, WebGrade disclaims all warranties,
              whether express, implied, or statutory, including merchantability,
              fitness for a particular purpose, non-infringement, accuracy of
              insights, and uninterrupted operation. We do not warrant that
              the service will identify every issue on your site, that
              recommendations will produce specific business results, or that
              third-party integrations will remain available.
            </p>
          </section>

          {/* 12. Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              12. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, WebGrade and its
              affiliates will not be liable for any indirect, incidental,
              consequential, special, or punitive damages, or for lost
              profits, revenue, or data, arising from or related to the
              service.
            </p>
            <p className="mt-3">
              Our total aggregate liability for any claims arising from the
              service is capped at the greater of <strong>(a)</strong> $100 or{' '}
              <strong>(b)</strong> the amount you paid us in the twelve months
              preceding the claim.
            </p>
            <p className="mt-3">
              Some jurisdictions don&apos;t allow these limits; in those
              places, the limits apply to the maximum extent allowed.
            </p>
          </section>

          {/* 13. Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              13. Indemnification
            </h2>
            <p>
              You will defend and indemnify WebGrade against third-party
              claims arising from <strong>(a)</strong> your use of the service
              in violation of these Terms, <strong>(b)</strong> your failure
              to obtain valid visitor consent on a site you instrument with
              our snippet, or <strong>(c)</strong> Customer Data that violates
              law or third-party rights.
            </p>
          </section>

          {/* 14. Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              14. Termination
            </h2>
            <p>
              <strong>By you.</strong> You may stop using the service and
              cancel your subscription at any time as described in section 8.
            </p>
            <p className="mt-3">
              <strong>By us.</strong> We may suspend or terminate your access
              if you materially breach these Terms (including non-payment or
              violations of section 5), if required by law, or if continued
              service would expose us or other customers to risk. We will give
              reasonable notice when feasible.
            </p>
            <p className="mt-3">
              <strong>Effect of termination.</strong> Your right to use the
              service ends immediately. Customer Data will be deleted as
              described in our{' '}
              <Link href="/privacy" className="text-[#0c4a6e] underline">
                Privacy Policy
              </Link>
              . Sections that by their nature should survive (data ownership,
              IP, disclaimers, liability, indemnity, governing law) survive
              termination.
            </p>
          </section>

          {/* 15. Changes */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              15. Changes to the service or these Terms
            </h2>
            <p>
              We may update the service over time, including by adding,
              removing, or modifying features. We may update these Terms by
              changing the date at the top of this page and posting the
              revised version. For material changes, we will notify customers
              by email at least 30 days before the change takes effect.
              Continuing to use the service after that date means you accept
              the updated Terms.
            </p>
          </section>

          {/* 16. Governing law */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              16. Governing law and disputes
            </h2>
            <p>
              These Terms are governed by the laws of the State of Texas,
              United States, without regard to conflict-of-laws rules. The
              exclusive venue for disputes is the state and federal courts
              located in Travis County, Texas, and each party consents to
              personal jurisdiction there. Nothing in this section prevents
              either party from seeking injunctive relief in any competent
              court to protect intellectual property or confidential
              information.
            </p>
          </section>

          {/* 17. Misc */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              17. Miscellaneous
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Entire agreement.</strong> These Terms plus the
                Privacy Policy and any order form or plan-specific terms
                referenced at checkout are the complete agreement between us
                regarding the service.
              </li>
              <li>
                <strong>Assignment.</strong> You may not assign these Terms
                without our written consent. We may assign them in connection
                with a merger, acquisition, or sale of assets.
              </li>
              <li>
                <strong>Severability.</strong> If a provision is unenforceable,
                the rest stays in effect.
              </li>
              <li>
                <strong>No waiver.</strong> Failure to enforce a right
                isn&apos;t a waiver.
              </li>
              <li>
                <strong>Force majeure.</strong> Neither party is liable for
                delays caused by events beyond reasonable control.
              </li>
            </ul>
          </section>

          {/* 18. Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-[#082f49] mb-3">
              18. Contact us
            </h2>
            <p>Questions about these Terms or your account:</p>
            <ul className="mt-3 space-y-1">
              <li>
                General:{' '}
                <a
                  href="mailto:support@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  support@webgrade.io
                </a>
              </li>
              <li>
                Billing:{' '}
                <a
                  href="mailto:billing@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  billing@webgrade.io
                </a>
              </li>
              <li>
                Legal:{' '}
                <a
                  href="mailto:legal@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  legal@webgrade.io
                </a>
              </li>
              <li>
                Security:{' '}
                <a
                  href="mailto:security@webgrade.io"
                  className="text-[#0c4a6e] underline"
                >
                  security@webgrade.io
                </a>
              </li>
            </ul>
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
