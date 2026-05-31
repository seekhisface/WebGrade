<!-- Role-specific view for Planner — excludes: Test conventions, Middleware chain, Build commands. Re-run ingest.sh to update. -->

# AGENTPIPELINE.md

## Project overview

WebGrade is a website intelligence SaaS platform with three products sold to SMB website operators and agencies: **WebGrade Interim Report™** (a one-time 45-day forensic behavioral audit), **WebWatch™** (always-on monthly monitoring with AI-generated reports), and **WebOpp™** (external market intelligence via keyword gap analysis). The platform ingests behavioral event data from a lightweight JavaScript snippet installed on customer websites, anonymizes all visitor data at the server boundary (no raw IPs ever stored), scores visitor intent, surfaces funnel drop-off pages with revenue-at-risk estimates, and generates AI-written reports using Claude. A demo account seeded with 90 days of NovaPulse HR fictional data supports the sales process. The codebase is a single Next.js 14 App Router monorepo — no microservices, no separate worker processes beyond Inngest cloud.


## Tech stack

- **Language**: TypeScript 5.3, strict mode
- **Runtime / framework**: Next.js 14.2 (App Router, React 18.2), Node.js runtime for all API routes
- **Database / ORM**: PostgreSQL (hosted on Supabase), Prisma 5.22 with manual migration workflow (see CLAUDE.md — `prisma migrate deploy` cannot run through the Supabase pooler)
- **Auth**: NextAuth 4.24 — JWT sessions, Google OAuth provider + CredentialsProvider (dev + demo only). PrismaAdapter deliberately removed; user/account management is in the `signIn` callback.
- **Background jobs**: Inngest 3.54 — all async processing, cron jobs, and event-driven jobs. Registered at `/api/inngest`.
- **AI**: `@anthropic-ai/sdk` 0.20 — claude-opus-4-20250514 for 400-token explanations, claude-sonnet-4-20250514 for 2000-token report generation. All calls use context injection via `src/lib/ai/context.ts`.
- **Styling**: Tailwind CSS 3.4, custom Frost design system (sky-blue/navy/teal brand colors). Dark background `#0a0a0f` in dashboard.
- **Email**: Resend 3.5 — `src/lib/email/sender.ts` handles alert emails and report distributions
- **File storage**: `@vercel/blob` 2.4 — used for async session export files (CSV/XLSX), 7-day retention with cleanup cron
- **SEO data**: DataForSEO API (keyword volume + competitor rank analysis) with a `KeywordVolumeCache` table to minimize API costs
- **Google integrations**: `googleapis` 171 — Google Search Console (webmasters API), Google Analytics 4 (reporting API); `google-ads-api` 23 — Google Ads campaign sync and gclid resolution
- **Analytics forwarding**: `posthog-node` 4.2 — consent-aware event forwarding to PostHog
- **Behavioral analytics**: Cal.com embed for scheduling on marketing page; PostHog 4.2 for product analytics
- **Export**: `exceljs` 4.4 (XLSX), `pdfkit` 0.18 (PDF reports)
- **Validation**: Zod 3.22 on all API route inputs
- **Scheduling**: Inngest cron expressions for all scheduled jobs
- **Build tooling**: Next.js compiler, `output: 'standalone'` for Docker; TypeScript errors and ESLint ignored during build (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`)
- **Test framework**: None — zero test files exist


## Repo structure

```
/
├── CLAUDE.md                    # Project instructions — manual migration workflow, env vars, code conventions
├── AGENTPIPELINE.md             # This file
├── README.md                    # Project overview
├── package.json                 # Single workspace; all scripts here
├── tsconfig.json                # Strict, module=bundler, paths: {"@/*": ["./src/*"]}
├── next.config.js               # output: standalone, pdfkit external, TS/ESLint errors ignored in build
├── tailwind.config.js           # Frost design system custom colors
├── postcss.config.js
├── Dockerfile                   # Multi-stage build for ECS deployment
├── prisma/
│   ├── schema.prisma            # ~1930-line complete schema (all models)
│   ├── migrations/              # Applied SQL migrations (manual-apply workflow)
│   │   ├── 20260503000000_baseline/
│   │   └── 20260503010000_add_widget_engaged_event_type/
│   ├── seed-demo.ts             # Seeds NovaPulse HR demo data (90 days behavioral)
│   ├── seed-seo.ts              # Seeds SEO/GSC demo data
│   └── seed-webwatch.ts         # Seeds WebWatch demo data
├── scripts/                     # One-off maintenance scripts (tsx)
│   ├── mark-migration-applied.ts  # Writes to _prisma_migrations after manual db execute
│   ├── seed-demo.ts             # Alternate demo seed entrypoint
│   ├── check-users.ts           # List all users + org memberships
│   ├── backfill-*.ts            # Historical data backfills
│   └── ...
├── public/
│   └── snippet/webgrade.js      # Client-side tracking snippet (~25KB raw, 7KB gzipped)
├── docs/
│   ├── architecture.md
│   └── integrations-checklist.md
├── deploy/                      # AWS ECS + Terraform deployment infrastructure
│   ├── terraform/
│   └── scripts/                 # build-and-deploy.sh, logs.sh, status.sh, setup-secrets.sh
├── WebGrade Ops/
│   └── old-migrations-archive/  # Pre-baseline SQL migrations (do not re-apply)
└── src/
    ├── app/
    │   ├── layout.tsx            # Root layout (PostHog provider)
    │   ├── page.tsx              # Root: redirect to /dashboard if auth, /marketing if not
    │   ├── globals.css
    │   ├── api/                  # All API routes (see API surface section)
    │   │   ├── ingest/route.ts   # P1-04: Main behavioral event ingestion endpoint
    │   │   ├── ai/
    │   │   │   ├── explain/      # Claude explanations (STUB — returns 'Loading...')
    │   │   │   ├── report/       # GET latest report for site
    │   │   │   └── webopp/       # WebOpp market intelligence via Claude
    │   │   ├── alerts/           # Alert delivery, resolution, settings
    │   │   ├── analytics/        # Drop-off and funnel analysis
    │   │   ├── admin/            # Super-admin sessions export + accounts view
    │   │   ├── auth/             # NextAuth + password verify
    │   │   ├── checkins/         # Day 7/14 onboarding check-in UX
    │   │   ├── dashboard/        # Dashboard data aggregation endpoints
    │   │   ├── ga4/              # Google Analytics 4 OAuth + import
    │   │   ├── gads/             # Google Ads OAuth + sync
    │   │   ├── gsc/              # Google Search Console OAuth + sync
    │   │   ├── healthz/          # System health check (polled by HealthBanner every 60s)
    │   │   ├── health-check/     # Site-level health check (HC-01 through HC-09)
    │   │   ├── inngest/          # Inngest webhook handler (registers all functions)
    │   │   ├── invite/[token]/   # Accept org invitation
    │   │   ├── onboarding/       # Multi-step onboarding data capture
    │   │   ├── profile/          # User profile, org members, site management
    │   │   ├── recommendations/  # Recommendation status updates and verification
    │   │   ├── reports/          # Archived reports CRUD
    │   │   ├── rt/               # Win-back report (generate, list, unlock)
    │   │   ├── seo/              # SEO data + crawl trigger
    │   │   ├── settings/         # Integration and profile settings
    │   │   ├── setup-state/      # Onboarding setup wizard state
    │   │   ├── sitemap/          # Deep crawl, CTAs management
    │   │   ├── snippet/          # Snippet status and verification
    │   │   ├── webwatch/         # WebWatch monthly intelligence data
    │   │   ├── ad-spend/         # Ad spend + UTM campaign data
    │   │   └── conversion-goals/ # Conversion goal CRUD
    │   ├── dashboard/
    │   │   ├── layout.tsx        # Auth guard (requireSession) + AppNav + HealthBanner
    │   │   ├── page.tsx          # Redirect to first active site
    │   │   ├── profile/page.tsx  # User profile settings
    │   │   └── [siteId]/
    │   │       ├── page.tsx      # Redirect to /overview
    │   │       ├── overview/     # Executive overview (default tab)
    │   │       ├── behavioral/   # Behavioral intelligence dashboard
    │   │       ├── detail/       # Session detail / visitor timeline
    │   │       ├── revenue/      # Revenue at risk and pipeline metrics
    │   │       ├── seo/          # Live SEO dashboard
    │   │       ├── webwatch/     # WebWatch monthly intelligence
    │   │       ├── webopp/       # WebOpp market opportunities
    │   │       ├── alerts/       # Alert center
    │   │       ├── winback/      # Win-back report management
    │   │       ├── sitemap/      # Site map deep crawl + CTA detection
    │   │       ├── snippet/      # Snippet installation instructions
    │   │       ├── setup/        # Post-onboarding setup wizard
    │   │       ├── report/       # Interim Report viewer (45-day WebAudit)
    │   │       ├── admin/
    │   │       │   ├── sessions/ # Super-admin raw session browser
    │   │       │   └── stale-utms/ # Stale UTM campaign viewer
    │   │       └── settings/
    │   │           ├── page.tsx          # Site settings root
    │   │           ├── alerts/           # Alert rule configuration
    │   │           └── distributions/    # Report distribution settings
    │   ├── admin/               # Super-admin account management (isSuperAdmin gate)
    │   ├── contact/             # Public contact form
    │   ├── demo/page.tsx        # Auto-signs in as demo@webgrade.io
    │   ├── invite/page.tsx      # Invitation acceptance flow
    │   ├── login/page.tsx       # Google OAuth + Credentials login + demo shortcut
    │   ├── marketing/page.tsx   # Public landing page (Frost theme, Cal.com scheduling)
    │   ├── onboarding/page.tsx  # 5-step onboarding flow (scenarios A/B/C)
    │   ├── privacy/             # Privacy policy page
    │   ├── report/[token]/      # Public win-back report (no auth, token-based)
    │   └── terms/               # Terms of service page
    ├── components/
    │   ├── auth/provider.tsx     # SessionProvider wrapper
    │   ├── dashboard/
    │   │   └── HealthBanner.tsx  # Polls /api/healthz every 60s; shows red banner on failure
    │   ├── demo/DemoBanner.tsx   # Demo mode indicator bar
    │   ├── marketing/            # Landing page section components
    │   ├── nav/AppNav.tsx        # Main nav: site switcher, tabs, user menu
    │   ├── overview/             # Overview dashboard components
    │   └── webwatch/
    │       └── RecommendationTracker.tsx
    ├── hooks/
    │   └── useSetupState.ts      # Client hook for setup wizard state
    ├── lib/
    │   ├── ai/
    │   │   └── context.ts        # OB-05: loadSiteContext, buildContextString, buildSystemPrompt, estimateDollarImpact
    │   ├── alerts/
    │   │   └── rules-engine.ts   # AL-01: evaluateAlertRules — 5 checks, 24hr debounce
    │   ├── analytics/
    │   │   ├── baseline.ts       # GA4 baseline metrics
    │   │   ├── benchmarks.ts     # Industry exit-rate / scroll-depth benchmarks per page category
    │   │   └── dropoff.ts        # P1-07: computeDropOffAnalysis — core drop-off engine
    │   ├── auth/
    │   │   ├── options.ts        # NextAuth config (Google + Credentials providers, JWT strategy)
    │   │   ├── session.ts        # requireSession, getUserOrgs, getUserSites, requireSiteAccess, verifySiteAccess
    │   │   └── super-admin.ts    # checkSuperAdmin (checks SUPER_ADMIN_EMAILS env var)
    │   ├── baseline/
    │   │   └── engine.ts         # captureBaseline, shouldResetBaseline — monthly metric snapshots
    │   ├── checkins/             # Day 7 / Day 14 onboarding check-in data
    │   ├── db/
    │   │   └── client.ts         # Prisma singleton (connection_limit=3 auto-appended to DATABASE_URL)
    │   ├── email/
    │   │   ├── sender.ts         # sendEmail (Resend), sendSlack, buildAlertEmail, buildReportEmail
    │   │   └── digest.ts         # sendDigestEmail for weekly digest
    │   ├── exports/
    │   │   └── sessions-export.ts # streamSessionsAsCsv, streamSessionsAsXlsx, buildExportFilename
    │   ├── ga4/
    │   │   └── client.ts         # syncGa4Data — fetches GA4 reporting API data
    │   ├── gads/
    │   │   └── client.ts         # syncCampaignData, resolveGclids — Google Ads API
    │   ├── gsc/
    │   │   └── client.ts         # syncGscData — Google Search Console API
    │   ├── jobs/
    │   │   └── inngest.ts        # All 19 Inngest function definitions + inngestFunctions export
    │   ├── privacy/
    │   │   └── fingerprint.ts    # deriveFingerprint (HMAC-SHA256, daily rotating salt via FINGERPRINT_SECRET)
    │   ├── report/
    │   │   ├── aggregator.ts     # aggregateReportData — fetches all data for report generation
    │   │   ├── generator.ts      # generateReport — orchestrates aggregation + Claude prompt + DB save
    │   │   └── prompt.ts         # Claude prompt builder for each report section
    │   ├── seo/
    │   │   ├── crawler.ts        # crawlSite — lightweight SEO crawler
    │   │   └── deep-crawl.ts     # runDeepCrawl — extracts CTAs + competitor data
    │   ├── sitemap/              # Site map crawl logic
    │   ├── tracking/
    │   │   ├── anonymize.ts      # DL-01: anonymizeRequest, hashIp, extractGeoFromHeaders, extractRawIp
    │   │   ├── bot-filter.ts     # P1-05: detectBotFromUserAgent, classifyDevice, classifyTrafficSource
    │   │   ├── intent-scoring.ts # P1-06: scoreSessionIntent — 5-factor, 0–100 score
    │   │   └── posthog.ts        # enqueueEvents — consent-aware PostHog forwarding
    │   ├── utils/
    │   │   └── rate-limit.ts     # checkRateLimit — in-memory per-IP rate limiter
    │   ├── verification/
    │   │   └── engine.ts         # evaluatePendingMeasurements — AI-verifies completed recommendations
    │   ├── webopp/
    │   │   ├── search-demand.ts  # aggregateSearchDemand, getKeywordVolumes (DataForSEO), getCompetitorKeywords
    │   │   └── cache.ts          # KeywordVolumeCache helpers, logApiUsage, checkDailyRateLimit
    │   └── webwatch/
    │       └── RecommendationTracker.tsx (component)
    └── types/
        └── next-auth.d.ts        # Extends Session to include user.id
```


## Data flow narratives

### Behavioral event ingestion (main data pipeline)

```
Customer website → public/snippet/webgrade.js
  → batches up to 50 events, sends POST /api/ingest (src/app/api/ingest/route.ts)
  → [rate limit check] checkRateLimit in src/lib/utils/rate-limit.ts (in-memory, 100 req/min)
  → [body validation] Zod IngestPayloadSchema — snippetId, sessionId, consentGiven, events[]
  → [site lookup] prisma.site.findUnique({ where: { snippetId } })
  → [DL-01 anonymization] anonymizeRequest() in src/lib/tracking/anonymize.ts
      → extractRawIp(headers) → hashIp(ip, siteId) → extractGeoFromHeaders(headers)
      → returns { ipHash, country, region } — rawIp never leaves this function
  → [bot detection] detectBotFromUserAgent(userAgent) in src/lib/tracking/bot-filter.ts
  → [DB transaction] prisma.$transaction:
      → visitorSession.upsert (@@unique[siteId, sessionId]) — creates or finds session
      → sessionEvent.createMany (batch insert, falls back to per-event on failure)
      → pageView.upsert (@@unique[sessionId, siteId, url]) — engagement aggregates per page
      → isExit correction — ensures only ONE pageView per session has isExit=true
      → visitorSession.update — pageCount, exitPage, UTM params, trafficSource
      → scoreSessionIntent() in src/lib/tracking/intent-scoring.ts — 0–100 score inline
  → [PostHog forwarding] enqueueEvents() in src/lib/tracking/posthog.ts (non-blocking)
  → returns { ok: true }
```

### Report generation (WebAudit / WebWatch)

```
Inngest cron job (webauditSnapshot or webwatchMonthlyReport) triggers
  → generateReport({ siteId, periodDays, ... }) in src/lib/report/generator.ts
  → aggregateReportData(siteId, null, periodDays) in src/lib/report/aggregator.ts:
      → loadSiteContext(siteId, null) in src/lib/ai/context.ts — fetches site + onboarding
      → computeDropOffAnalysis({ siteId, periodDays }) in src/lib/analytics/dropoff.ts
      → prisma.siteBaseline.findMany — GA4 baseline metrics
      → prisma.alert.findMany — alert history for period
      → computeTopLeaks — ranked top 3 exit pages by qualified-visitor loss
      → computeIntentDistribution — HIGH/MEDIUM/LOW/BOT counts
      → computePaidCampaigns — paid traffic verdicts
      → computeSeoSnapshot — GSC keyword + CWV data (if connected)
  → buildSystemPrompt(ctx, 'report') in src/lib/ai/context.ts
  → Claude API call (claude-sonnet-4-20250514, max 2000 tokens) in src/lib/report/prompt.ts
  → prisma.report.create/update with generated content
  → Report available at GET /api/ai/report?siteId=xxx → /dashboard/[siteId]/report
```

### AI explain endpoint

```
Dashboard UI → POST /api/ai/explain (src/app/api/ai/explain/route.ts)
NOTE: This endpoint is currently STUBBED — returns { explanation: 'Loading...' }.
The full implementation using Claude with context injection is pending.
```

### WebOpp analysis

```
POST /api/ai/webopp (src/app/api/ai/webopp/route.ts)
  → auth + site access check
  → extractSeedKeywords({ domain, businessDescription, competitorDomains })
  → aggregateSearchDemand({ seedKeywords, competitorDomains, ourDomain }) in src/lib/webopp/search-demand.ts
      → getCachedKeywordVolumes — checks KeywordVolumeCache table first
      → DataForSEO /keywords_data/google_ads/search_volume/live (batches of 100)
      → DataForSEO /dataforseo_labs/google/domain_rank_overview/live per competitor
      → cacheKeywordVolumes — writes fresh results to KeywordVolumeCache
  → Claude API call (claude-opus-4-20250514, max 400 tokens) with webopp prompt
  → prisma.webOppAnalysis.create + prisma.webOppKeywordCluster.createMany
  → returns analysis with missed revenue estimates
```

### Alert pipeline

```
Inngest cron (runAlertRules, every hour)
  → evaluateAlertRules(siteId) in src/lib/alerts/rules-engine.ts
      → 5 checks: checkConversionDrop, checkBounceSurge, checkWastedSpend, checkSnippetHealth, checkSeoRegression
      → 24-hour debounce per alert type
  → prisma.alert.create if threshold crossed
  → alert delivered via sendEmail() or sendSlack() in src/lib/email/sender.ts
    when the user triggers POST /api/alerts/deliver or the digest runs
```

### Auth flow

```
User → /login (src/app/login/page.tsx)
  → Google OAuth: NextAuth signIn callback creates or finds User, upserts Account record
  → Credentials: bcrypt compare for password users; plain-text compare for demo@webgrade.io
  → JWT issued with user.id + user.email
  → Dashboard routes: requireSession() in src/lib/auth/session.ts reads JWT via getServerSession()
  → Site access: requireSiteAccess(userId, siteId) or verifySiteAccess(email, siteId)
    checks User → OrgMember → Organization → Site chain; super admins bypass this check
```

### Session export (async)

```
Dashboard admin → POST /api/admin/sessions/export/queue
  → auth + site access check
  → inngest.send({ name: 'webgrade/session-export.requested', data: { siteId, recipientEmail, ... } })
  → Inngest picks up generateSessionExport function in src/lib/jobs/inngest.ts:
      → streamSessionsAsCsv or streamSessionsAsXlsx from src/lib/exports/sessions-export.ts
      → @vercel/blob put('exports/filename', stream, { access: 'public', addRandomSuffix: true })
      → sendEmail to recipientEmail with download link (7-day expiry per blob cleanup cron)
```


## Full database schema

> Copied verbatim from prisma/schema.prisma. All tables listed in order.

### Enums

```prisma
enum OrgRole { OWNER ADMIN VIEWER }
enum SitePlatform { WORDPRESS WEBFLOW SHOPIFY SQUARESPACE WIX NEXT_JS CUSTOM UNKNOWN }
enum DataRegion { US EU }
enum SubscriptionTier { WEBAUDIT WEBAUDIT_EXPIRED WEBWATCH WEBWATCH_WEBOPP }
enum HealthStatus { GREEN YELLOW RED UNKNOWN }
enum InstallMethod { GTM WORDPRESS WEBFLOW SHOPIFY CLOUDFLARE MANUAL BULK_CSV }
enum InstallStatus { PENDING INSTALLED VERIFIED FAILED }
enum IntentClass { HIGH MEDIUM LOW RESEARCHER COMPETITOR BOT }
enum EventType {
  PAGE_VIEW PAGE_EXIT PAGE_LOAD_COMPLETE SCROLL CLICK CTA_CLICK NAV_CLICK
  HESITATION RAGE_CLICK FORM_FOCUS FORM_SUBMIT CONVERSION ROUTE_CHANGE
  SECTION_VIEW EXIT_INTENT TAB_BLUR TAB_FOCUS COPY_TEXT FILE_DOWNLOAD WIDGET_ENGAGED CUSTOM
}
enum CrawlStatus { RUNNING COMPLETED FAILED PARTIAL }
enum CtaType { DEMO SIGNUP TRIAL CONTACT BUY SUBSCRIBE DOWNLOAD OTHER }
enum CtaStatus { SUGGESTED TRACKED IGNORED }
enum ReportType { INTERIM WEBWATCH WEBOPP WINBACK }
enum ReportStatus { GENERATING COMPLETE FAILED PARTIAL }
enum ComparisonMode { VS_BASELINE VS_PRIOR_YEAR VS_PRIOR_MONTH }
enum SourceModule { BEHAVIORAL SEO AD_SPEND WEBOPP HEALTH_CHECK }
enum FixType { CONTENT TECHNICAL AD_SPEND SEO UX TRACKING UNKNOWN }
enum TaskStatus { TODO IN_PROGRESS DONE DISMISSED }
enum ImplementationStatus { OPEN IN_PROGRESS IMPLEMENTED VERIFIED STALLED ABANDONED CONTRADICTION }
enum VerificationStatus { UNVERIFIED IMPROVED PARTIAL NO_CHANGE REGRESSED INSUFFICIENT_DATA }
enum AlertType {
  CONVERSION_DROP BOUNCE_RATE_SPIKE INTENT_SCORE_DROP TRAFFIC_ANOMALY
  SEO_REGRESSION NEW_CRITICAL_SEO_ISSUE CRAWL_ERROR
  WASTED_SPEND_DETECTED ZERO_CONVERSION_CAMPAIGN UTM_STRIPPING
  NEW_HIGH_VALUE_OPPORTUNITY COMPETITOR_ENTERED_CLUSTER DEMAND_SPIKE DEMAND_DECAY
  SNIPPET_FIRING_STOPPED CONVERSION_GOAL_UNREACHABLE
}
enum AlertSeverity { CRITICAL HIGH MEDIUM LOW }
enum MeasurementStatus { PENDING MEASURING COMPLETE INSUFFICIENT_DATA }
enum ResultType { WORKED PARTIAL NO_CHANGE INSUFFICIENT_DATA }
enum AnalysisStatus { RUNNING COMPLETE FAILED }
enum OpportunityDecision { YES MAYBE NO }
enum DistributionRole { OWNER STAKEHOLDER EXEC CUSTOM }
enum DigestFrequency { WEEKLY BIWEEKLY MONTHLY ON_PUBLISH }
enum DistributionChannel { EMAIL SLACK BOTH }
enum RetentionTargetType { PROSPECT TRIAL_USER CUSTOMER CHURNED LAPSED }
enum RetentionTriggerType {
  METRIC_IMPROVEMENT NEW_OPPORTUNITY MILESTONE_HIT
  DORMANT_REACTIVATION COMPETITOR_SIGNAL BENCHMARK_GAP_WIDENING REPORT_READY
}
enum RetentionSequenceStatus {
  WATCHING QUALIFYING ACTIVE PAUSED COMPLETED UNSUBSCRIBED CONVERTED
}
```

### Models

**users** — NextAuth user table
```
id String PK cuid
email String unique
name String?
image String?
hashedPassword String?
emailVerified DateTime?
isSuperAdmin Boolean default false
createdAt/updatedAt DateTime
→ accounts[], sessions[], orgMemberships[], dpaAcceptances[], sentInvitations[]
```

**accounts** — NextAuth OAuth accounts
```
id String PK cuid
userId String FK users
type/provider/providerAccountId String
refresh_token/access_token String? Text
expires_at Int?
token_type/scope/id_token/session_state String?
@@unique([provider, providerAccountId])
```

**sessions** — NextAuth sessions (JWT mode, not DB sessions — effectively unused)
```
id String PK, sessionToken String unique, userId String FK, expires DateTime
```

**verification_tokens** — NextAuth verification tokens
```
identifier/token/expires; @@unique([identifier, token])
```

**organizations** — Multi-site operator account
```
id String PK cuid
name String
slug String unique
createdAt/updatedAt DateTime
→ members[], sites[], reportDistributions[], invitations[]
```

**org_members** — User ↔ Organization membership
```
id String PK cuid
orgId String FK organizations
userId String FK users
role OrgRole default VIEWER
joinedAt DateTime
@@unique([orgId, userId])
```

**org_invitations** — Pending email invitations
```
id String PK cuid
orgId String FK organizations
email String, role OrgRole default VIEWER
token String unique default cuid
invitedBy String FK users
expiresAt DateTime, createdAt DateTime
@@unique([orgId, email])
```

**sites** — Website being monitored (core entity)
```
id String PK cuid
orgId String FK organizations
name/domain/url String
platform SitePlatform?, timezone String default "America/New_York"
industry/description String? Text
dataRegion DataRegion default US
isActive Boolean default true
hasInterimReport/hasWebWatch/hasWebOpp Boolean default false
subscriptionTier SubscriptionTier default WEBAUDIT
webauditStartDate/webauditEndDate DateTime?
webwatchStartDate/baselineResetDate DateTime?
checkin7AcknowledgedAt/checkin14AcknowledgedAt DateTime?
lastDeepCrawlAt DateTime?
posthogEnabled Boolean, posthogApiKey String?
gscConnected Boolean, gscPropertyUrl/gscConnectedByUserId String?, gscConnectedAt/gscLastSyncAt DateTime?
gadsConnected Boolean, gadsCustomerId/gadsConnectedByUserId String?, gadsConnectedAt/gadsLastSyncAt DateTime?
ga4Connected Boolean, ga4PropertyId/ga4ConnectedByUserId String?, ga4ConnectedAt/ga4LastSyncAt DateTime?
snippetId String unique default cuid  ← public ID embedded in snippet
@@index([orgId]), @@index([domain])
```

**site_onboardings** — 5-step onboarding form data per site
```
id String PK, siteId String unique FK sites
conversionGoalUrl/conversionGoalName/conversionFormSelector String?
businessDescription/targetAudience/primaryValueProp/currentPainPoints String? Text
competitorUrls String[] default []
ga4PropertyId/ga4AccessToken/ga4RefreshToken String?, ga4BaselineImportedAt DateTime?
monthlyAdSpend/averageOrderValue/leadToWinRate/conversionRate Float?
isComplete Boolean default false, completedAt DateTime?
completedSteps Int[] default [], skippedSetupItems String[] default []
```

**conversion_goals** — Multiple conversion goals per site
```
id String PK, siteId String FK sites
name String, url String, isActive Boolean default true, createdAt DateTime
@@index([siteId])
```

**site_baselines** — Versioned metric snapshots (never overwritten)
```
id String PK, siteId String FK sites
metricKey String  -- e.g. "sessions_90d", "bounce_rate", "conversion_rate"
value Float, period String  -- e.g. "2024-Q4", "webaudit_30d"
source String  -- "ga4_import", "manual", "webgrade_calculated"
capturedAt DateTime
@@index([siteId, metricKey])
```

**competitor_snapshots** — Puppeteer crawl of competitor sites (monthly refresh)
```
id String PK, siteId String FK sites
competitorUrl/aboveFold Text?/ctaText String?
pricingFound Boolean, pageSpeedScore Float?, crawledAt DateTime
@@index([siteId])
```

**site_health_checks** — Per-site health check results (HC-01 through HC-09)
```
id String PK, siteId String FK sites, checkedAt DateTime
snippetFires Boolean?, snippetFireTimeMs Int?, snippetStatus HealthStatus
spaFramework String?, spaRouteEventsWork Boolean?, spaStatus HealthStatus
conversionGoalReachable/conversionGoalSnippetFires Boolean?, conversionGoalStatus HealthStatus
utmPreservedToGoal/utmStrippingDetected Boolean?, utmStatus HealthStatus
duplicateSnippetCount Int default 0, duplicateStatus HealthStatus
consentBannerDetected/consentBlocksSnippet Boolean?, consentStatus HealthStatus
estimatedBotPercent Float?, botStatus HealthStatus
lighthouseLcp/lighthouseFid/lighthouseCls Float?, lighthouseScore Int?, pageSpeedStatus HealthStatus
overallStatus HealthStatus, fixInstructions Json?
@@index([siteId, checkedAt])
```

**site_installations** — Auto-install tracking (GTM, WordPress, Webflow, etc.)
```
id String PK, siteId String unique FK sites
method InstallMethod?, status InstallStatus default PENDING
installedAt/lastVerifiedAt DateTime?
gtmContainerId/gtmWorkspaceId/gtmTagId String?
platformAccessToken/platformRefreshToken/platformMetadata String?/Json?
```

**visitor_sessions** — One row per visitor visit (DL-01: no raw IP stored)
```
id String PK cuid, siteId String FK sites, sessionId String (client pseudonymous ID)
ipHash String (SHA-256 of ip+siteId+salt), country/region String?
userAgent String? Text, deviceType/browser/os String?
utmSource/utmMedium/utmCampaign/utmTerm/utmContent/referrer String?
clickId/clickIdType String?  -- gclid, fbclid, msclkid, etc.
resolvedCampaignId/resolvedCampaignName/resolvedAdGroupId String?
gclidResolvedAt DateTime?, gclidResolutionStatus String?
utmCampaignIsStale Boolean default false
startedAt DateTime default now, endedAt DateTime?, durationMs Int?
trafficSource String?, isReturning Boolean default false
intentScore Int? (0-100), intentClass IntentClass?
isBotFiltered Boolean, botReason/botCategory/isBotSuspect Boolean/botSuspectReason String?
isBounce Boolean, pageCount Int, entryPage/exitPage String?
convertedAt DateTime?, conversionGoalHit Boolean
adSourceId String? FK ad_sources
@@unique([siteId, sessionId])
@@index([siteId, startedAt]), [siteId, intentClass], [siteId, isBotFiltered]
@@index([siteId, clickIdType, gclidResolvedAt])
```

**session_events** — Raw behavioral events from snippet (deleted after 90 days)
```
id String PK, sessionId String FK visitor_sessions, siteId String FK sites
eventType EventType, pageUrl String, timestamp DateTime
scrollDepthPct Int?, elementTag/elementText/elementClass String?, isCtaClick Boolean
hesitationMs/rageClickCount/timeOnPageMs Int?, metadata Json?
@@index([sessionId]), [siteId, eventType, timestamp]
```

**page_views** — Per-page engagement aggregates (deleted after 90 days)
```
id String PK, sessionId String FK visitor_sessions, siteId String FK sites
url String, title String?, enteredAt DateTime, exitedAt DateTime?
timeOnPageMs/maxScrollDepthPct Int?, clickCount/rageClickCount/hesitationCount Int
isExit Boolean, exitIntentDetected Boolean
isDropOffPage/storylineBreakpoint Boolean
@@unique([sessionId, siteId, url])
@@index([siteId, url])
```

**seo_crawls** — SEO crawl job tracking
```
id String PK, siteId String FK sites
startedAt/completedAt DateTime?, pagesFound/pagesAnalyzed Int, crawlStatus CrawlStatus
isDeepCrawl Boolean default false
overallSeoScore/technicalScore/onPageScore/contentScore/crawlabilityScore Int?
@@index([siteId, startedAt])
```

**seo_page_results** — Per-page SEO scoring from crawler
```
id String PK, crawlId String FK seo_crawls, siteId String FK sites
url String, crawledAt DateTime
statusCode/responseTimeMs Int?, redirectChain String[], canonicalUrl String?
lcp/fid/cls/ttfb Float?, mobileScore/desktopScore Int?
title/metaDescription String? Text, titleLength/metaDescLength/h1Count Int?
h1Text String? Text, h2Count/altTextMissing/internalLinks/externalLinks/wordCount Int?
onPageScore Int?, isMobileResponsive Boolean?, renderBlockingScripts Int?
hasStructuredData/jsRenderRequired Boolean?, frameworkDetected String?
isIndexable/hasNoindex/robotsTxtBlocked/isInSitemap Boolean?
crawlDepth Int?, isOrphanPage Boolean?, contentScore Int?
searchIntentMatch Float?, isThinContent/isOutdated Boolean?
issues Json[] default []
@@index([crawlId]), [siteId, url]
```

**seo_keyword_rankings** — Daily keyword position tracking (from GSC)
```
id String PK, siteId String FK sites, crawlId String? FK seo_crawls
date DateTime, keyword String
position/ctr Float, clicks/impressions Int, intent/description/trend String
positionDelta Float, trend String
@@unique([siteId, keyword, date])
@@index([siteId, date])
```

**seo_traffic_snapshots** — Daily organic traffic aggregates (from GSC)
```
id String PK, siteId String FK sites, date DateTime
totalSessions/organicSessions Int, organicPct Float
clicks/impressions Int, ctr/avgPosition Float
indexedPages/crawlErrors/notIndexed/newPagesFound Int
keywordsTop3/Top10/Top30/Total Int
@@unique([siteId, date])
```

**ad_sources** — UTM source quality scoring
```
id String PK, siteId String FK sites
source/medium/campaign/term/content String
qualityScore Int?, avgIntentScore/avgScrollDepth/conversionRate Float?
has404LandingPage/hasSlowLandingPage/hasZeroConversions Boolean
estimatedWastedSpend Float?, platformSpend Float?, platformImpressions/Clicks Int?
platformCpc Float?, intentByHour/conversionByHour Json?
landingPageUrl String?, landingPageAlignScore Int?
@@unique([siteId, source, medium, campaign])
```

**gads_campaign_metrics** — Daily Google Ads spend by campaign
```
id String PK, siteId String FK sites
date DateTime, campaignId/campaignName/campaignType/status String
costMicros BigInt, impressions/clicks Int, conversions/conversionValue Float
cpc/ctr/costPerConversion Float?
@@unique([siteId, campaignId, date])
```

**site_ctas** — CTAs detected on customer site by deep crawler
```
id String PK, siteId String FK sites
competitorUrl String default ""  -- empty = customer's own site
ctaText String (max 200), ctaHref String default "", ctaType CtaType
pages String[], pageCount Int, status CtaStatus default SUGGESTED
firstDetectedAt/lastDetectedAt DateTime
@@unique([siteId, competitorUrl, ctaText, ctaHref])
```

**stale_utm_campaigns** — utm_campaign values not found in recent Google Ads data
```
id String PK, siteId String FK sites
utmCampaign String, sessionsAffected Int, firstDetectedAt/lastSeenAt DateTime
topLandingPage String?
@@unique([siteId, utmCampaign])
```

**reports** — WebAudit / WebWatch / WebOpp / WinBack report records
```
id String PK, siteId String FK sites, type ReportType, status ReportStatus
version Int, isDiff Boolean
periodStart/periodEnd DateTime
behavioralSummary/adSpendSummary/seoSummary String? Text
seoScore/seoIssueCount/totalWastedSpend Int?/Float?
executiveSummary String? Text, topFindings/topRecommendations Json?
estimatedImpact String? Text, pdfUrl String?, pdfGenAt DateTime?
shareToken String? unique, shareExpiresAt/shareUnlockedAt DateTime?
shareRecipient String?, generatedAt/createdAt DateTime
@@index([siteId, createdAt])
```

**archived_reports** — Monthly archive snapshots (immutable)
```
id String PK, siteId String FK sites, type String
periodStart/periodEnd DateTime, title/summary String
kpiSnapshot/findings/actionItems Json, createdAt DateTime
@@index([siteId, createdAt])
```

**ab_test_ideas** — A/B test hypotheses per report
```
id String PK, reportId String FK reports, recommendationId String?
hypothesis/variant/successMetric String, estimatedLift String?, priority Int
```

**monthly_performance_reports** — Living monthly AI narrative
```
id String PK, siteId String FK sites, reportId String? FK reports
year Int, month Int (1-12), label String
comparisonMode ComparisonMode, baselineLabel/priorPeriodLabel String?
executiveNarrative String Text, praisePoints/concernPoints/topOpportunities/contradictions Json?
sessions/intentScore/conversionRate metrics (Now/Baseline/MoM Float?)
revenueAtRiskNow/revenueRecoveredTotal Float?
totalRecs/verifiedFixed/inProgress/stalled/contradictions2/openUnacted Int
performanceGrade String?, generatedAt/updatedAt DateTime
@@unique([siteId, year, month])
```

**recommendations** — Prioritized fix recommendations
```
id String PK, siteId String FK sites, reportId String? FK reports
sourceModule SourceModule, title/finding/fixAction String Text
expectedResult String? Text
impactScore/effortScore/confidenceScore/priorityScore Int  -- priorityScore = impact × (11-effort) × confidence
fixType FixType, status TaskStatus default TODO, assignee String?, completedAt DateTime?
linearIssueId/jiraIssueId/asanaTaskId/notionPageId String?
implementationStatus ImplementationStatus default OPEN
customerNote String? Text, customerUpdatedAt DateTime?
baselineMetricKey/baselineMetricLabel String?, baselineMetricValue/targetMetricValue Float?
lastVerifiedAt DateTime?, lastVerifiedValue Float?
verificationStatus VerificationStatus, verificationNote String? Text
contradictionFlag Boolean, contradictionNote String? Text
metricHistory Json?
estimatedMonthlyImpact/recoveredMonthlyValue Float?
@@index([siteId, priorityScore]), [siteId, status], [siteId, implementationStatus]
```

**alerts** — Fired alert records
```
id String PK, siteId String FK sites
alertType AlertType, severity AlertSeverity, productModule SourceModule
message String Text, metadata Json?
triggeredAt DateTime, resolvedAt/acknowledgedAt DateTime?
resolvedAutomatically Boolean, resolutionTimeMs Int?
emailSentAt/slackSentAt/smsSentAt DateTime?
@@index([siteId, triggeredAt]), [siteId, alertType, resolvedAt]
```

**alert_settings** — Per-site alert configuration
```
id String PK, siteId String FK sites
alertType AlertType, isEnabled Boolean, severity AlertSeverity
emailEnabled/slackEnabled/smsEnabled Boolean
slackChannel String?, smsRecipients String[]
quietHoursStart/End Int?, emailRecipients String[]
@@unique([siteId, alertType])
```

**measurement_jobs** — Re-measurement tracking for recommendations
```
id String PK, recommendationId String unique FK recommendations, siteId String FK sites
productModule SourceModule, createdAt/measureAfterDate/completedAt DateTime?
status MeasurementStatus default PENDING
beforeValue/afterValue/changePct Float?, isSignificant Boolean?, sampleSize Int?
resultType ResultType?, narrative String? Text
@@index([siteId, status])
```

**impact_reports** — Monthly ROI summary
```
id String PK, siteId String FK sites, period String (e.g. "2025-03")
tasksCompleted/tasksWorked Int, winRate/conversionLiftPct Float?
estimatedSpendSaved/estimatedRevenueCaptured Float?
summary String? Text, sentAt DateTime?, emailedTo String[]
@@index([siteId, period])
```

**webopp_analyses** — WebOpp analysis job records
```
id String PK, siteId String FK sites
status AnalysisStatus, startedAt/completedAt DateTime?
totalMissedLeadsPerMonth Int?, totalMissedRevenuePerMonth Float?
totalOpportunitiesFound Int?, topOpportunityCluster String?
→ keywordClusters[], budgetModels[]
```

**webopp_keyword_clusters** — Per-keyword opportunity scoring
```
id String PK, analysisId String FK webopp_analyses, siteId String FK sites
clusterName/keywords[]/primaryKeyword String
monthlySearchVolume Int?, competition Float?, avgCpc Float?, source String?
currentRankPosition/currentMonthlyClicks Int?, visibilityScore Float?
topCompetitorUrl String?, competitorRankPosition Int?, isCompetitorKeyword Boolean
missedImpressions/missedClicks/missedLeads Int?, missedRevenue Float?
competitionDifficulty/monthsToRank Int?, estimatedCpaForPaid/roiPotential Float?
decision OpportunityDecision?, isLocalKeyword Boolean, localProximityRank Int?
hasHighVideoIntent Boolean, youtubeSearchVolume Int?
@@index([analysisId]), [siteId, decision]
```

**webopp_budget_models** — Channel budget projections per analysis
```
id String PK, analysisId String FK webopp_analyses
channel String  -- "google_ads", "meta_ads", "seo_organic", "youtube"
currentMonthlySpend/recommendedMonthlySpend/maxMarketSpend Float?
expectedLeads/expectedWins Int?, expectedRevenue Float?
roiTimeline/breakEvenMonths Int?, stairStepPlan Json?
```

**keyword_volume_cache** — DataForSEO response cache
```
id String PK, keyword String, locationCode Int default 2840
monthlySearchVolume Int, competition/avgCpc Float, difficulty Int, fetchedAt DateTime
@@unique([keyword, locationCode])
```

**api_usage_logs** — API cost tracking
```
id String PK, provider String (dataforseo/anthropic/google)
endpoint String, siteId String?, keywordsQueried Int, estimatedCost Float, calledAt DateTime
@@index([provider, calledAt])
```

**contact_inquiries** — Marketing page lead capture
```
id String PK, name/email/phone?/company?/website? String, message String? Text
source String?, createdAt DateTime
@@index([email])
```

**report_distributions** — Who receives which reports
```
id String PK, siteId String FK sites, orgId String FK organizations
recipientEmail/recipientName String?, role DistributionRole
receiveInterimReport/WebWatch/WebOpp/WeeklyDigest/Alerts Boolean
webWatchFrequency DigestFrequency, digestDay Int?, digestHour Int default 8
customMessage String? Text, deliveryChannel DistributionChannel
slackWebhookUrl String?, isActive Boolean
@@index([siteId]), [orgId]
```

**snippet_retention_targets** — Win-back / retention prospect tracking
```
id String PK, siteId String FK sites
sessionFingerprint String, firstSeenAt/lastSeenAt DateTime, visitCount Int
highestIntentScore Int?, pagesVisited String[], reachedPricing/reachedSignup/exitedAtSignup Boolean
conversionGoalHit Boolean, totalSessionsCount Int
targetType RetentionTargetType, customerId String?
triggerType RetentionTriggerType?, triggerFiredAt DateTime?, triggerPayload Json?
sequenceStatus RetentionSequenceStatus, sequenceStep Int, lastContactedAt/nextContactAt DateTime?
unsubscribedAt DateTime?, reEngaged Boolean, reEngagedAt DateTime?
convertedFromRetention Boolean, createdAt DateTime
@@index([siteId, targetType]), [siteId, sequenceStatus], [siteId, nextContactAt]
```

**dpa_acceptances** — GDPR Data Processing Agreement acceptance log
```
id String PK, userId String FK users, siteId String FK sites
dpaVersion String, acceptedAt DateTime, ipHash String (DL-01 compliant)
@@unique([userId, siteId, dpaVersion])
```

**data_retention_logs** — Audit log of all automated data deletions (DL-04)
```
id String PK, siteId String FK sites
deletionType/periodCovered String, recordsDeleted Int, executedAt DateTime
```


## API surface

All routes are under `src/app/api/`. Authentication is JWT via NextAuth unless marked public.

### Ingestion (public, CORS-open)
- `POST /api/ingest` — behavioral event batch from snippet. No auth. Rate limited 100 req/min per IP. CORS: all origins. Body: `{ snippetId, sessionId, consentGiven, events[] }`. Returns `{ ok: true }` or `{ ok: true, bot: true }`.
- `OPTIONS /api/ingest` — CORS preflight

### AI
- `POST /api/ai/explain` — **STUB** — returns `{ explanation: 'Loading...' }`. Auth required. (Full Claude explain endpoint pending implementation.)
- `GET /api/ai/report?siteId=xxx` — retrieve latest INTERIM report for a site. Auth required. Returns full report object with parsed behavioral sections.
- `POST /api/ai/webopp` — generate WebOpp market intelligence via DataForSEO + Claude. Auth required. Body: `{ siteId }`.

### Alerts
- `POST /api/alerts/deliver` — trigger email/Slack delivery for an alert. Auth required. Body: `{ alertId, siteId }`.
- `POST /api/alerts/resolve` — mark alert as resolved. Auth required.
- `PATCH /api/alerts/resolve/[alertID]` — resolve specific alert by ID.
- `GET /api/alerts/settings?siteId=xxx` — get alert settings for a site. Auth required.
- `PUT /api/alerts/settings` — update alert settings. Auth required.
- `POST /api/alerts/test` — send test alert. Auth required.

### Analytics
- `GET /api/analytics/dropoff?siteId=xxx&days=45` — drop-off page analysis. Auth required. Returns `DropOffAnalysis`.
- `GET /api/analytics/funnel?siteId=xxx` — funnel step analysis. Auth required.

### Dashboard data
- `GET /api/dashboard?siteId=xxx` — main dashboard data aggregation. Auth required.
- `GET /api/dashboard/overview?siteId=xxx` — overview tab metrics. Auth required.
- `GET /api/dashboard/overview/detail?siteId=xxx` — expanded overview detail. Auth required.
- `GET /api/dashboard/detail?siteId=xxx&sessionId=xxx` — individual session detail. Auth required.

### Auth
- `GET/POST /api/auth/[...nextauth]` — NextAuth catch-all. Public.
- `POST /api/auth/verify-password` — verify current password for profile changes. Auth required.

### Google integrations
- `GET /api/gsc/authorize` — initiate GSC OAuth (scopes: webmasters.readonly). Auth required.
- `GET /api/gsc/callback` — GSC OAuth callback. Saves access/refresh tokens to `accounts` table.
- `POST /api/gsc/connect?siteId=xxx` — connect GSC property to site.
- `POST /api/gsc/sync?siteId=xxx` — manually trigger GSC data sync.
- `GET /api/ga4/authorize` — initiate GA4 OAuth. Auth required.
- `GET /api/ga4/callback` — GA4 OAuth callback.
- `GET /api/ga4/properties?siteId=xxx` — list GA4 properties for connected account.
- `POST /api/ga4/import?siteId=xxx` — import GA4 baseline metrics.
- `GET /api/gads/authorize` — initiate Google Ads OAuth. Auth required.
- `GET /api/gads/callback` — Google Ads OAuth callback.
- `GET /api/gads/accounts?siteId=xxx` — list accessible Google Ads accounts.
- `POST /api/gads/sync?siteId=xxx` — manually sync Google Ads campaign data.

### Onboarding
- `POST /api/onboarding` — save onboarding step data. Auth required. Body: `{ siteId, step, data }`.
- `POST /api/onboarding/create-site` — create a new site during onboarding. Auth required.
- `POST /api/onboarding/complete?siteId=xxx` — mark onboarding complete. Auth required.
- `POST /api/onboarding/revenue?siteId=xxx` — save revenue context. Auth required.

### Profile / org management
- `GET/PUT /api/profile` — user profile. Auth required.
- `POST /api/profile/invite` — send org invitation. Auth required. OWNER/ADMIN only.
- `GET /api/profile/members?orgId=xxx` — list org members. Auth required.
- `GET /api/profile/sites` — list user's sites. Auth required.
- `GET /api/invite/[token]` — get invitation details. Public.

### Reports
- `GET /api/reports/archive?siteId=xxx` — list archived reports. Auth required.
- `GET /api/reports/archive/[id]?siteId=xxx` — get specific archived report. Auth required.

### Win-back (RT)
- `POST /api/rt/generate` — generate a win-back prospect report. Auth required.
- `GET /api/rt/list?siteId=xxx` — list win-back reports. Auth required.
- `POST /api/rt/unlock` — unlock a prospect win-back report. Auth required.

### SEO
- `GET /api/seo?siteId=xxx` — SEO dashboard data (latest crawl results + keyword rankings). Auth required.
- `POST /api/seo/crawl?siteId=xxx` — trigger on-demand SEO crawl. Auth required.
- `POST /api/seo/broken-links?siteId=xxx` — check for broken links. Auth required.

### Sitemap / deep crawl / CTAs
- `POST /api/sitemap/crawl?siteId=xxx` — trigger deep crawl (CTAs + competitor data). Auth required.
- `GET /api/sitemap/status?siteId=xxx` — get latest crawl status. Auth required.
- `GET /api/sitemap/ctas?siteId=xxx` — list detected CTAs. Auth required.
- `POST /api/sitemap/ctas/bulk` — bulk update CTA statuses. Auth required.
- `PATCH /api/sitemap/ctas/[id]/status` — update single CTA status (SUGGESTED/TRACKED/IGNORED). Auth required.
- `POST /api/detect-ctas?siteId=xxx` — trigger CTA detection. Auth required.

### Snippet
- `GET /api/snippet?siteId=xxx` — get snippet installation code. Auth required.
- `GET /api/snippet/status?siteId=xxx` — check whether snippet is firing. Auth required.
- `POST /api/snippet/verify?siteId=xxx` — verify snippet installation. Auth required.

### Health
- `GET /api/healthz` — system health check (DB + ingest tables). Public. Returns 200/503. Polled by HealthBanner every 60s.
- `GET /api/healthz?deep=1` — includes recent ingest activity check.
- `GET /api/health-check?siteId=xxx` — site-level health check (HC-01 through HC-09). Auth required.

### WebWatch
- `GET /api/webwatch?siteId=xxx` — WebWatch monthly intelligence data. Auth required.

### Ad spend
- `GET /api/ad-spend?siteId=xxx` — ad spend and UTM campaign quality data. Auth required.

### Recommendations
- `POST /api/recommendations/status` — update implementation status. Auth required. Body: `{ recommendationId, status, customerNote }`.
- `POST /api/recommendations/verify` — trigger AI verification of recommendation. Auth required.

### Conversion goals
- `GET /api/conversion-goals?siteId=xxx` — list conversion goals. Auth required.
- `POST /api/conversion-goals` — create conversion goal. Auth required.

### Check-ins (Day 7 / Day 14 onboarding)
- `GET /api/checkins/state?siteId=xxx` — check-in state. Auth required.
- `POST /api/checkins/acknowledge?siteId=xxx` — acknowledge check-in. Auth required.
- `GET /api/checkins/data-quality?siteId=xxx` — data quality metrics for check-in banner. Auth required.

### Setup wizard
- `GET /api/setup-state?siteId=xxx` — get post-onboarding setup state. Auth required.
- `POST /api/setup-state/skip` — skip a setup step. Auth required.

### Settings
- `GET/PUT /api/settings/integrations?siteId=xxx` — integration settings. Auth required.
- `GET/PUT /api/settings/profile` — profile settings. Auth required.

### Admin (super admin only — `isSuperAdmin` check)
- `GET /api/admin/accounts` — list all user accounts. Super admin only.
- `GET /api/admin/sessions?siteId=xxx` — raw session browser for admin. Super admin only.
- `GET /api/admin/sessions/export?siteId=xxx` — streaming session CSV/XLSX export. Super admin only.
- `POST /api/admin/sessions/export/queue` — queue async session export (sends via Inngest + Vercel Blob + email).
- `GET /api/admin/sessions/summary?siteId=xxx` — session summary stats. Super admin only.
- `GET /api/admin/stale-utms?siteId=xxx` — view stale UTM campaigns. Super admin only.

### Contact
- `POST /api/contact` — contact form submission. Public. Saves to `contact_inquiries`.

### Inngest
- `GET /api/inngest` — Inngest webhook registration/health. Used by Inngest cloud.
- `POST /api/inngest` — Inngest event handler (processes all background jobs).


## Authentication and authorization

**Token type**: JWT (NextAuth 4.24, `strategy: 'jwt'`). The JWT contains `{ id, email }` and is read via `getServerSession(authOptions)` in server components/routes.

**Session type extension**: `src/types/next-auth.d.ts` adds `user.id` to the `Session` interface.

**Providers**:
1. Google OAuth (`allowDangerousEmailAccountLinking: true`) — GSC scope is NOT requested at login; it's requested separately via `/api/gsc/authorize` when the user connects GSC.
2. CredentialsProvider — bcrypt compare for password users. Demo account (`demo@webgrade.io`) uses plain-text compare against `DEMO_PASSWORD` env var.

**User creation on Google OAuth**: The `signIn` callback in `src/lib/auth/options.ts` manually creates the `User` + `Account` records (PrismaAdapter was deliberately removed to avoid `OAuthAccountNotLinked` errors). Tokens are refreshed on every re-auth.

**Authorization model** (User → OrgMember → Organization → Site):
- `requireSession()` — server-side guard; redirects to `/login` if no session.
- `getUserSites(userId, email)` — returns all sites for user's orgs; super admins get ALL sites.
- `requireSiteAccess(userId, siteId)` — checks `Site.org.members.some(userId)`, redirects to `/dashboard` if unauthorized. Returns site + org + onboarding.
- `verifySiteAccess(email, siteId)` — API-route variant; returns null instead of redirecting. Super admins bypass org check.
- `checkSuperAdmin(email)` — checks `SUPER_ADMIN_EMAILS` env var (comma-separated).

**Roles**: `OrgRole.OWNER | ADMIN | VIEWER`. Invitation endpoints require OWNER or ADMIN. Viewer can read dashboards but cannot configure alerts or invite members.

**Demo access**: `/demo` page auto-signs in as `demo@webgrade.io` using CredentialsProvider. Demo account is pre-seeded with NovaPulse HR data.

**Public routes** (no auth): `/api/ingest`, `/api/healthz`, `/api/auth/*`, `/api/contact`, `/report/[token]` (win-back), `/api/invite/[token]` (GET).


## Environment variables

### Required in production
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma PostgreSQL connection (Supabase pooler URL — `?connection_limit=3` auto-appended if missing) |
| `DIRECT_URL` | Direct non-pooled Postgres URL (required by Prisma schema for migrations) |
| `NEXTAUTH_URL` | e.g. `https://app.webgrade.io` |
| `NEXTAUTH_SECRET` | JWT signing secret — `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for login + GSC/GA4/Ads OAuth) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | Claude API key |
| `RESEND_API_KEY` | Email delivery API key |
| `EMAIL_FROM` | Email sender address e.g. `alerts@webgrade.io` |
| `INNGEST_EVENT_KEY` | Inngest event publishing key |
| `INNGEST_SIGNING_KEY` | Inngest webhook signature verification |
| `FINGERPRINT_SECRET` | HMAC salt for daily rotating fingerprint (DL-01) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — auto-injected on Vercel deploy; needed manually otherwise |
| `SUPER_ADMIN_EMAILS` | Comma-separated super admin emails e.g. `Mike@...,Jason@...` |

### Required for optional features
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (default: `https://app.posthog.com`) |
| `DATAFORSEO_LOGIN` | DataForSEO email (WebOpp) |
| `DATAFORSEO_PASSWORD` | DataForSEO password |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC/manager account ID (if using managed accounts) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS (not yet implemented) |

### Optional with defaults
| Variable | Default | Purpose |
|---|---|---|
| `DEMO_PASSWORD` | `DemoPass2026!` | Demo account password override |
| `INGEST_RATE_LIMIT_PER_MINUTE` | `100` | Ingest API rate limit per IP |
| `DATA_RETENTION_DAYS` | `90` | Raw event retention (SessionEvent + PageView) |
| `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` | — | Client-side copy of super admin list (for UI gating) |


## Key files — where things live

**New API endpoint**: Create `src/app/api/<domain>/route.ts`. Export named functions (`GET`, `POST`, `PATCH`, `DELETE`). Add `export const dynamic = 'force-dynamic'` at top. Call `getServerSession(authOptions)` + `verifySiteAccess()` for auth. Use `z.safeParse()` for input. Follow pattern in `/api/alerts/settings/route.ts`.

**New database table**: Edit `prisma/schema.prisma`. Then follow CLAUDE.md manual migration workflow: `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --script > /tmp/diff.sql`, mkdir migration dir, execute against DB, mark applied via `scripts/mark-migration-applied.ts`, regenerate client.

**New background job**: Add an Inngest function to `src/lib/jobs/inngest.ts` using `inngest.createFunction()`. Export it from the `inngestFunctions` array at the bottom of the file. The function is auto-registered at `/api/inngest`.

**New dashboard page**: Create `src/app/dashboard/[siteId]/<tab>/page.tsx`. It's automatically auth-guarded by `src/app/dashboard/layout.tsx`. Add tab to `src/components/nav/AppNav.tsx`.

**New frontend component**: Add to `src/components/<domain>/`. PascalCase filename. Import with `@/components/<domain>/ComponentName`.

**Shared types**: Add to `src/types/` or co-locate in the lib file that owns them. Import with `@/types/` or `@/lib/`.

**External service integration**: Add client to `src/lib/<service>/client.ts`. Follow pattern in `src/lib/gsc/client.ts` or `src/lib/gads/client.ts`.

**Seeding demo data**: `npx tsx prisma/seed-demo.ts` or `npx tsx scripts/seed-demo.ts`. Seeds NovaPulse HR with 90 days of behavioral data for `demo@webgrade.io`.


## Naming conventions

- **Files**: `kebab-case.ts` for all source files; `route.ts` for App Router API routes; `page.tsx` for App Router pages; `layout.tsx` for layouts
- **React components**: PascalCase (`AppNav.tsx`, `HealthBanner.tsx`)
- **Functions / methods**: camelCase (`requireSession`, `scoreSessionIntent`)
- **Types / interfaces**: PascalCase (`SiteContext`, `IntentScoreResult`, `ReportData`)
- **Database tables**: snake_case in Prisma `@@map()` (`visitor_sessions`, `session_events`)
- **Prisma model names**: PascalCase (`VisitorSession`, `SessionEvent`)
- **Import alias**: `@/` maps to `src/`
- **Event types**: SCREAMING_SNAKE_CASE (`PAGE_VIEW`, `FORM_FOCUS`, `CONVERSION`)
- **Enum values**: SCREAMING_SNAKE_CASE (`GREEN`, `YELLOW`, `RED`, `HIGH`)
- **Inngest event names**: `webgrade/<domain>.<action>` (e.g. `webgrade/session.ended`, `webgrade/session-export.requested`)
- **Section comments**: `// ------…-----` dividers; module-level comments reference requirement IDs (`// P1-04`, `// DL-01`)
- **Test files**: No convention — no tests exist


## External integrations

| Service | Purpose | Files |
|---|---|---|
| **Anthropic Claude** | Report generation (sonnet-4), explanations + WebOpp (opus-4) | `src/lib/ai/context.ts`, `src/lib/report/prompt.ts`, `src/app/api/ai/*` |
| **DataForSEO** | Keyword volume lookup, competitor rank data (WebOpp) | `src/lib/webopp/search-demand.ts`, `src/lib/webopp/cache.ts` |
| **Resend** | Transactional email (alerts, reports, export links) | `src/lib/email/sender.ts` |
| **Inngest** | Background jobs + cron scheduling | `src/lib/jobs/inngest.ts`, `/api/inngest` |
| **Vercel Blob** | Session export file storage (7-day retention, public URLs) | `src/lib/jobs/inngest.ts` (generateSessionExport), `src/lib/exports/sessions-export.ts` |
| **PostHog** | Behavioral analytics forwarding (consent-aware) | `src/lib/tracking/posthog.ts` |
| **Google Search Console** | Keyword rankings, organic traffic data | `src/lib/gsc/client.ts`, `/api/gsc/*` |
| **Google Analytics 4** | Baseline metrics import | `src/lib/ga4/client.ts`, `/api/ga4/*` |
| **Google Ads** | Campaign spend sync, gclid resolution | `src/lib/gads/client.ts`, `/api/gads/*` |
| **Cal.com** | Demo scheduling embed on marketing page | `@calcom/embed-react`, `src/app/marketing/page.tsx` |
| **Supabase** | PostgreSQL hosting + connection pooler (pgBouncer) | `DATABASE_URL` + `DIRECT_URL` env vars |
| **Twilio** | SMS alerts (installed but NOT yet implemented) | Dependency only |

**DataForSEO gotcha**: Keyword volume calls cost ~$0.00075 per keyword. The `KeywordVolumeCache` table prevents re-fetching. A daily rate limit (50 calls) is enforced via `checkDailyRateLimit()`. Batches are capped at 100 keywords per API call.

**Google OAuth scopes**: Standard login uses no extra scopes. GSC requires `webmasters.readonly` (requested separately at `/api/gsc/authorize` — not at login, to avoid Google app verification requirements). GA4 requires `analytics.readonly`. Google Ads requires developer token + customer ID.

**Inngest timing**: Inngest Cloud doesn't apply Vercel's 60s HTTP timeout to `step.run()` bodies, making it suitable for long-running exports and report generation. Self-hosted Inngest still has a longer timeout than HTTP.


## Files and directories agents must NOT touch

- `prisma/migrations/` — SQL files are the migration source of truth; never hand-edit
- `node_modules/` — managed by npm
- `.next/` — Next.js build output
- `package-lock.json` — regenerated by npm
- `prisma/schema.prisma` — edit only following the CLAUDE.md manual migration workflow (edit → diff → apply → mark applied → generate)
- `public/snippet/webgrade.js` — customer-facing snippet; changes require coordinated deploy since customers embed the URL
- `WebGrade Ops/old-migrations-archive/` — archived pre-baseline migrations; must NOT be re-applied
- `deploy/terraform/` — Terraform state; manual apply required, never auto-apply


## Known patterns and gotchas

1. **Build ignores TypeScript errors.** `next.config.js` has `ignoreBuildErrors: true`. A green build does NOT mean the code typechecks. Always run `npm run typecheck` before reporting work complete.

2. **Prisma migrate deploy is broken on this Supabase pooler.** The pgBouncer transaction-mode pooler can't acquire Prisma's advisory lock. Never add `prisma migrate deploy` to any script or CI. Use `prisma db execute` + `mark-migration-applied.ts` manually. See full workflow in CLAUDE.md.

3. **Per-event fallback on batch insert.** In `src/app/api/ingest/route.ts`, `sessionEvent.createMany()` falls back to per-event `sessionEvent.create()` if the batch fails (most common cause: a new EventType enum value not yet migrated to DB). This prevents one bad event from dropping a whole batch. This is intentional.

4. **isExit=true correction in ingest.** The snippet fires `page_exit` on every navigation, so a multi-page session would have `isExit=true` on every pageView. The ingest route corrects this by updating all pageViews in the session to `isExit=false` except the most-recent one (ordered by `enteredAt desc`).

5. **Intent scoring runs inline in ingest, not just in Inngest.** `scoreSessionIntent()` is called within the ingest DB transaction for every event batch. The Inngest `scoreSessionIntent` function handles re-scoring when `webgrade/session.ended` fires at session end (for high-traffic accuracy). Both call the same pure function.

6. **connection_limit=3 is auto-appended.** `src/lib/db/client.ts` appends `?connection_limit=3` to DATABASE_URL if not present. This prevents a single serverless instance from exhausting the Supabase pool (default pool_size=15 shared across all instances).

7. **PrismaAdapter was intentionally removed.** `src/lib/auth/options.ts` does NOT use `@auth/prisma-adapter` — it was causing `OAuthAccountNotLinked` errors. User/Account records are managed manually in the `signIn` callback.

8. **The `ai/explain` endpoint is a stub.** `src/app/api/ai/explain/route.ts` immediately returns `{ explanation: 'Loading...' }`. The full Claude implementation is pending.

9. **Super admin access is email-list based.** `checkSuperAdmin()` in `src/lib/auth/super-admin.ts` checks against `SUPER_ADMIN_EMAILS` env var (comma-separated). `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` is the public-facing copy for client-side UI gating.

10. **Demo account uses plain-text password.** `demo@webgrade.io` is checked with a plain string compare (not bcrypt) against `process.env.DEMO_PASSWORD ?? 'DemoPass2026!'`. This is intentional for demo speed. Do not bcrypt it.

11. **Bot suspect detection is separate from bot filtering.** `isBotFiltered=true` means definitive bot (UA match). `isBotSuspect=true` means behavioral heuristic (instant exit, no scroll, rapid multipage). Bot suspects stay in human counts but are flagged. Three patterns: `instant_exit_no_interaction`, `no_scroll_single_page`, `rapid_multipage`.

12. **`behavioralSummary` column stores JSON, not text.** The `Report.behavioralSummary` field is a `String? @db.Text` but the ingest pipeline stores structured JSON inside it (parsed in `/api/ai/report` GET handler). Don't treat it as a plain text summary.

13. **DataForSEO uses Basic auth.** `src/lib/webopp/search-demand.ts` encodes `login:password` in base64 for the Authorization header — not OAuth.

14. **Google OAuth tokens stored in `accounts` table.** When a user connects GSC, GA4, or Ads (which all require re-authorization with extra scopes), the `Account.access_token` and `refresh_token` are updated in the `signIn` callback. The `gscConnectedByUserId`, `ga4ConnectedByUserId`, `gadsConnectedByUserId` fields on `Site` point to the User whose `Account` record holds the valid tokens.

15. **HealthBanner polls every 60s.** If a schema migration is deployed without `db execute`, the `visitor_sessions` table count probe fails and a red banner appears across all authenticated pages within one minute. This is the intentional drift detection mechanism.

16. **`output: 'standalone'`** means Next.js builds a self-contained server bundle for Docker deployment. The `deploy/` directory contains Terraform + ECS scripts.

17. **`DIRECT_URL` is required by Prisma schema** for migrations and direct queries that bypass the pooler. Supabase provides this separately from the pooled `DATABASE_URL`.


## Open questions / gaps

1. **`src/lib/report/generator.ts`** — The report generation orchestrator function `generateReport()` is referenced in Inngest jobs but was not fully read. Verify whether it handles all report types (INTERIM vs WEBWATCH) or only one.

2. **`src/lib/seo/crawler.ts` and `deep-crawl.ts`** — SEO crawler and deep crawl implementation. CLAUDE.md says the Puppeteer crawler is "not yet implemented" but `crawlSite()` and `runDeepCrawl()` are called from Inngest jobs. Clarify current implementation status.

3. **`src/lib/baseline/engine.ts`** — `captureBaseline()` and `shouldResetBaseline()` are called from multiple Inngest jobs but were not read. Verify what metrics are captured and how baseline reset is detected.

4. **`src/lib/verification/engine.ts`** — `evaluatePendingMeasurements()` handles AI verification of completed recommendations but was not read. Verify whether it makes Claude API calls and how it determines metric improvement.

5. **Rate limiter is in-memory** — resets on every cold start. If there are multiple Vercel instances, each has its own counter. For production with meaningful traffic, replace with Redis/Upstash.

6. **`/api/ai/explain` is a stub** — returns `'Loading...'` immediately. If a builder needs to implement the explain endpoint, the context injection pattern in `src/lib/ai/context.ts` and `buildSystemPrompt(ctx, 'explain')` are the right starting point.

7. **Session export streaming format** — `streamSessionsAsCsv` and `streamSessionsAsXlsx` in `src/lib/exports/sessions-export.ts` were not read. Verify the exact columns exported and any pagination logic.

<!-- CUSTOM:BEGIN -->
<!-- Add any manually maintained notes below this line.
     This section is preserved verbatim on every ingest re-run.
     Use it for: known gotchas, tribal knowledge, deploy notes,
     third-party quirks, anything the codebase will not reveal. -->
<!-- CUSTOM:END -->
