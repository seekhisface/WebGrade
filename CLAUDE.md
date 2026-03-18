# CLAUDE.md — WebGrade

## Quick Reference

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run db:generate  # prisma generate (after schema changes)
npm run db:push      # prisma db push (sync schema to DB)
npm run db:migrate   # prisma migrate dev (production migrations)
npm run db:studio    # prisma studio (DB browser)
```

Seed demo data: `npx tsx scripts/seed-demo.ts`
Seed behavioral data: `npx tsx scripts/seed-behavioral.ts` (1200 sessions for NovaPulse HR)

No test suite exists yet. No `npm test` script.

## What This Project Is

WebGrade is a website intelligence platform with three products:
- **WebGrade Interim Report** — one-time 45-day forensic audit
- **WebWatch** — always-on monthly SaaS monitoring
- **WebOpp** — external market intelligence (keyword gaps, missed revenue)

All three live in one Next.js 14 App Router codebase, one Prisma schema, one auth system.

## Tech Stack (verified from package.json and imports)

- **Framework**: Next.js 14.1.0 (App Router, React 18.2)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4 with custom brand colors (Frost theme: sky blue/navy/teal)
- **Database**: PostgreSQL, accessed through Prisma 5.22.0
- **Auth**: NextAuth 4.24.0 (Google OAuth + Credentials provider, JWT sessions)
- **Background jobs**: Inngest 3.0.0
- **Behavioral analytics**: PostHog 4.2.0 (event forwarding, consent-aware)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk` v0.20)
  - `claude-opus-4-20250514` for explanations (max 400 tokens)
  - `claude-sonnet-4-20250514` for report generation (max 2000 tokens)
- **Email**: Resend 3.5.0 (`src/lib/email/sender.ts`)
- **SEO Data**: DataForSEO API (`src/lib/webopp/search-demand.ts`)
- **SMS**: Twilio 5.0.0 (dependency installed, not yet used)
- **Validation**: Zod 3.22.0 on all API routes
- **Scheduling**: Cal.com (embedded modal on marketing page)

## Critical Rules

### IP Anonymization (DL-01) — LEGAL NON-NEGOTIABLE
Raw IPs must **never** be written to the database. Two anonymization layers exist:

1. **Ingestion path**: `anonymizeRequest()` in `src/lib/tracking/anonymize.ts` — SHA-256 hash of `(ip + siteId + "webgrade-v1")`
2. **Fingerprint path**: `deriveFingerprint()` in `src/lib/privacy/fingerprint.ts` — HMAC-SHA256 of `(ip + UA + screen + timezone)` with daily rotating salt via `FINGERPRINT_SECRET` env var

Both discard raw IP after hashing. Only `ipHash`, `country`, and `region` are stored.

If you add any new endpoint that touches user traffic data, it **must** go through one of these functions first.

### Consent Tracking (DL-02)
The client snippet checks OneTrust (C0002), Cookiebot, and Google Consent Mode v2. Without consent, tracking runs in anonymous mode (sessionStorage only). The server validates `consentGiven` and skips PostHog forwarding when false.

### Data Retention (DL-04)
Raw `SessionEvent` and `PageView` records are deleted after 90 days by a daily Inngest cron job. Derived data (scores, reports) is retained. Deletions are logged in `DataRetentionLog`.

## Auth & Demo Access

- **Google OAuth**: requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- **Dev login**: CredentialsProvider enabled only in `NODE_ENV=development` — signs in any seeded user by email
- **Demo account**: `demo@webgrade.io` / `DemoPass2026!` (password overridable via `DEMO_PASSWORD` env var)
- **Session helpers** in `src/lib/auth/session.ts`:
  - `requireSession()` — guard for authenticated server component routes
  - `getUserOrgs()` — fetches user's orgs + sites
  - `requireSiteAccess(siteId)` — verifies org membership for a specific site
- **API auth helper** in `src/lib/auth/api.ts`:
  - `requireApiSession()` — returns `{ userId, email }` or null for API routes
  - `unauthorizedResponse()` — returns a 401 NextResponse

## Code Conventions

### Naming
- **Import alias**: `@/` maps to `src/`
- **API routes**: `route.ts` exporting named functions (`POST`, `GET`)
- **React components**: PascalCase
- **Utility functions**: camelCase
- **Event types**: SCREAMING_SNAKE_CASE (`PAGE_VIEW`, `FORM_FOCUS`, `CONVERSION`)
- **Enum values**: SCREAMING_SNAKE_CASE (`GREEN`, `YELLOW`, `RED`, `HIGH`, `MEDIUM`, `LOW`)

### Error Handling
- Zod `safeParse()` for input validation; return issues in 400 responses
- Try/catch around async ops; non-critical failures log and continue (don't crash the request)
- Status codes: 400 validation, 401 unauthorized, 404 not found, 429 rate limited

### Database
- Prisma singleton in `src/lib/db/client.ts` with dev hot-reload guard (global cache)
- All queries enforce org membership as the access boundary — no direct site access without checking the user's org role
- Permission model: User → OrgMember (OWNER/ADMIN/VIEWER) → Organization → Site

### AI Context Injection (OB-05)
All Claude API calls use context injection via `src/lib/ai/context.ts`:
- `loadSiteContext()` — fetches site + onboarding data
- `buildContextString()` — injects business description, target audience, AOV, conversion rate
- `buildSystemPrompt(mode)` — mode-specific prompts for: explain, report, recommend, webopp
- `estimateDollarImpact()` — computes revenue impact from engagement lift

### Shared Modules — Use These, Don't Duplicate
- **Types**: `src/types/index.ts` — `Site`, `IntentDistribution`, `DropOffPage`, `DashboardData`, `ActionItem`, `GrowthPlay`, `ReportPayload`, `Alert`
- **Style constants**: `src/lib/constants/styles.ts` — `SEVERITY_STYLES`, `ALERT_ICONS`, `EFFORT_COLORS`, `CHANNEL_LABELS`, `INTENT_CONFIG`
- **Format utilities**: `src/lib/utils/format.ts` — `formatDate()`, `formatMoney()`, `formatDateTime()`, `formatTimeAgo()`, `formatPercent()`
- **Hooks**: `src/lib/hooks/useCountUp.ts` — animated number counter with optional trigger
- **API auth**: `src/lib/auth/api.ts` — `requireApiSession()` + `unauthorizedResponse()`

### Tailwind Colors
Use theme tokens from `tailwind.config.js` — **do not use raw hex values** in Tailwind classes:
- `bg-page-bg`, `border-page-border` (light blue theme)
- `bg-nav-bg`, `border-nav-border` (dark navy nav)
- `text-status-green`, `text-status-red`, `text-status-yellow` (semantic colors)
- Standard Tailwind: `text-slate-500`, `text-slate-900`, `text-slate-400`, etc.

### Comments
- Section dividers use `// -----…----` pattern
- Module-level comments reference requirement IDs (e.g., `// P1-04`, `// DL-01`)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   ├── explain/route.ts     # Claude explanations (drop-off, intent, ad source, SEO)
│   │   │   ├── report/route.ts      # Interim Report generation (Claude Sonnet, 120s timeout)
│   │   │   └── webopp/route.ts      # WebOpp market intelligence (DataForSEO + Claude)
│   │   ├── alerts/
│   │   │   ├── deliver/route.ts     # Email/Slack alert delivery
│   │   │   ├── resolve/route.ts     # Mark alerts resolved
│   │   │   ├── settings/route.ts    # Alert rule configuration
│   │   │   └── test/route.ts        # Test alert delivery
│   │   ├── analytics/
│   │   │   └── dropoff/route.ts     # Drop-off page analysis (P1-07)
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── health-check/route.ts
│   │   ├── ingest/route.ts
│   │   ├── inngest/route.ts
│   │   ├── onboarding/route.ts
│   │   ├── recommendations/status/route.ts
│   │   └── rt/                      # Win-back reports (public, token-based)
│   │       ├── generate/route.ts
│   │       ├── list/route.ts
│   │       └── unlock/route.ts
│   ├── dashboard/
│   │   ├── layout.tsx               # Auth-guarded layout with AppNav
│   │   ├── page.tsx                 # Root redirect to first site
│   │   └── [siteId]/
│   │       ├── page.tsx             # Behavioral intelligence (server component, real DB queries)
│   │       ├── DashboardClient.tsx  # Client component for dashboard interactivity
│   │       ├── report/page.tsx      # Interim Report viewer
│   │       ├── seo/page.tsx         # Live SEO dashboard
│   │       ├── webwatch/page.tsx    # WebWatch monthly intelligence
│   │       ├── webopp/page.tsx      # WebOpp market opportunities
│   │       ├── alerts/page.tsx      # Alert center
│   │       ├── winback/page.tsx     # Win-back report management
│   │       └── settings/
│   │           ├── alerts/page.tsx  # Alert configuration
│   │           └── distributions/page.tsx
│   ├── demo/page.tsx                # Demo mode entry (auto-signs in as demo user)
│   ├── login/page.tsx               # Login (Google + dev login + demo shortcut)
│   ├── marketing/page.tsx           # Public landing page (features, pricing, CTA)
│   ├── onboarding/page.tsx          # 5-step onboarding (scenarios A/B/C)
│   ├── report/[token]/page.tsx      # Public win-back report (no auth)
│   └── page.tsx                     # Root (→ /dashboard if auth, → /marketing if not)
├── components/
│   ├── auth/provider.tsx            # SessionProvider wrapper
│   ├── demo/DemoBanner.tsx          # Demo mode indicator
│   ├── nav/AppNav.tsx               # Main nav — rendered by dashboard/layout.tsx, NOT individual pages
│   └── webwatch/RecommendationTracker.tsx
├── lib/
│   ├── ai/context.ts               # OB-05 context injection for Claude prompts
│   ├── alerts/rules-engine.ts       # Alert checks with 24hr debounce
│   ├── analytics/
│   │   ├── baseline.ts             # GA4 baseline metrics
│   │   ├── benchmarks.ts           # Industry benchmarking
│   │   └── dropoff.ts              # Drop-off analysis
│   ├── auth/
│   │   ├── api.ts                  # requireApiSession, unauthorizedResponse (API routes)
│   │   ├── options.ts              # NextAuth config
│   │   └── session.ts              # requireSession, getUserOrgs, requireSiteAccess (pages)
│   ├── constants/styles.ts         # SEVERITY_STYLES, ALERT_ICONS, INTENT_CONFIG, etc.
│   ├── hooks/useCountUp.ts         # Animated number counter hook
│   ├── db/client.ts                # Prisma singleton
│   ├── email/sender.ts             # Resend email + Slack webhook delivery
│   ├── jobs/inngest.ts             # Background job definitions
│   ├── privacy/fingerprint.ts      # HMAC-SHA256 fingerprinting (DL-01 compliant)
│   ├── report/
│   │   ├── aggregator.ts           # Data aggregation for report generation
│   │   └── prompt.ts               # Claude prompt builder for report sections
│   ├── tracking/
│   │   ├── anonymize.ts            # DL-01 IP hashing
│   │   ├── bot-filter.ts           # UA pattern matching + headless detection
│   │   ├── intent-scoring.ts       # 5-factor intent classification
│   │   └── posthog.ts              # Consent-aware event forwarding
│   ├── utils/
│   │   ├── format.ts              # formatDate, formatMoney, formatTimeAgo, etc.
│   │   └── rate-limit.ts          # In-memory rate limiter
│   ├── webopp/search-demand.ts     # DataForSEO keyword volume + gap analysis
│   └── webwatch/                   # WebWatch monitoring logic
├── types/index.ts                   # Shared TypeScript interfaces
prisma/
│   ├── schema.prisma               # ~1546 lines, all modules
│   └── seed-demo.ts                # Seeds NovaPulse HR demo data (90 days)
scripts/
│   ├── seed-demo.ts                # Alternate demo seed location
│   ├── seed-behavioral.ts          # Seed 1200 visitor sessions with pageviews/events
│   ├── check-users.ts              # List all users + org memberships
│   └── fix-demo-membership.ts      # Fix demo user linkage
public/
│   └── snippet/webgrade.js         # Client-side tracking snippet
```

## What's Implemented vs Stubbed

### Working
- Auth (Google OAuth + Credentials + demo account)
- Multi-org/multi-site structure with role-based access
- Onboarding flow (5-step form with scenarios A/B/C)
- Ingestion API with rate limiting, validation, bot filtering, IP anonymization
- Intent scoring (5-factor algorithm with classifications)
- Bot detection (UA patterns + headless browser detection)
- Alert rules engine with email/Slack delivery via Resend
- AI explanation API with business context injection
- AI report generation (executive summary + action items + growth plays via Claude Sonnet)
- WebOpp market intelligence (DataForSEO + Claude for keyword gap analysis)
- Drop-off analysis API
- Dashboard pages for all products (behavioral, SEO, WebWatch, WebOpp, alerts)
- Marketing landing page with pricing and Cal.com scheduling
- Demo mode with full seed data (NovaPulse HR, 90 days of behavioral data)
- Win-back report system (public token-based reports)
- Inngest job definitions
- Full Prisma schema (~1546 lines)
- Email and Slack delivery (`src/lib/email/sender.ts`)
- Privacy-first fingerprinting with daily salt rotation

### Still Stubbed or Incomplete
- **Health check**: some checks return hardcoded placeholder values (SPA detection, page speed)
- **SEO crawler** (P2-01): Puppeteer crawler not implemented
- **Re-measurement loop** (RM-*): schema exists, no code
- **GA4 import** (OB-03): OAuth flow stubbed in onboarding
- **SMS alerts via Twilio**: dependency installed, not used
- **Dashboard data**: behavioral dashboard is wired to real DB; other pages (SEO, WebWatch, WebOpp) still use hardcoded demo data

## Known Issues

1. **Rate limiter is in-memory** — resets on every server restart/redeploy. Needs Upstash Redis for production.
2. **No rate limit on Claude API** — `/api/ai/explain` and `/api/ai/report` check auth but have no per-user quota.
3. **No test coverage** — zero test files in the repo.
4. **Demo password hardcoded** — `DemoPass2026!` is in the login page source; override with `DEMO_PASSWORD` env var.
5. **Report generation timeout** — `/api/ai/report` uses `maxDuration: 120` (Vercel-specific); may need adjustment for other hosts.
6. **Snippet duplicate detection**: uses >200 events/session heuristic which may false-positive on high-engagement sites.

## Environment Variables

### Used in code
- `DATABASE_URL` — Prisma PostgreSQL connection
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — NextAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `EMAIL_FROM` — email sender address
- `ANTHROPIC_API_KEY` — Claude API
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` — PostHog
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — Inngest
- `RESEND_API_KEY` — email delivery via Resend
- `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` — WebOpp keyword data
- `DEMO_PASSWORD` — override demo account password (default: `DemoPass2026!`)
- `FINGERPRINT_SECRET` — HMAC salt for privacy fingerprinting
- `INGEST_RATE_LIMIT_PER_MINUTE` — rate limit (default: 100)
- `DATA_RETENTION_DAYS` — raw event retention (default: 90)

### In .env.example but not yet used
- `TWILIO_*` — SMS not implemented
- `POSTHOG_PERSONAL_API_KEY` — not used
- `NEXT_PUBLIC_SNIPPET_VERSION`, `NEXT_PUBLIC_APP_URL` — not used

## Data Flow

```
Snippet (public/snippet/webgrade.js)
    ↓ [anonymized events]
POST /api/ingest (rate-limited, IP hashed, bot filtered)
    ↓ [saved to VisitorSession, SessionEvent, PageView]
PostgreSQL (via Prisma)
    ↓ [aggregation via Inngest jobs]
POST /api/ai/report → Claude Sonnet (context-injected)
    ↓
Report saved to DB → /dashboard/[siteId]/report
    ↓ [scheduled delivery]
/api/alerts/deliver → Resend email / Slack webhook
    ↓
User inbox
```
