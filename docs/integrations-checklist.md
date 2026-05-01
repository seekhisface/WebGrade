# WebGrade Environment Setup — Integrations Checklist

This is the canonical list of everything that has to be configured for a WebGrade deployment to actually function. Use this when standing up a new environment (staging, prod) so derived data populates correctly.

If a cron job in this list is not firing or an integration is "(never)" connected, the dashboard will still render but specific metrics will appear empty or stale (SEO data, drop-off analysis, scheduled reports, alerts, etc.).

---

## 1. Required environment variables

These must be set on the deployment host (Vercel project settings, AWS Secrets Manager, `.env.local`, etc.).

### Database
| Var | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Prisma connection string (pooler) | Supabase → Settings → Database → Connection pooling |
| `DIRECT_URL` | Direct (non-pooled) connection for migrations | Supabase → Settings → Database → Direct connection |

### Auth
| Var | Purpose |
|---|---|
| `NEXTAUTH_URL` | Full deployment URL (e.g. `https://webgrade.io`) |
| `NEXTAUTH_SECRET` | Random secret for JWT signing — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | OAuth client (used for sign-in AND for GSC/GA4/GAds API access) |
| `GOOGLE_CLIENT_SECRET` | Matching client secret |

### AI / external APIs
| Var | Purpose | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API for report generation, explanations, WebOpp | console.anthropic.com |
| `RESEND_API_KEY` | Email delivery for alerts + weekly digest | resend.com |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Keyword volume data for WebOpp | dataforseo.com |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Required for any Google Ads API calls (campaign sync, gclid resolver) | Google Ads → Tools → API Center |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional. Set this if accounts are accessed via an MCC (manager) account | Google Ads UI |

### Background jobs (Inngest)
| Var | Purpose |
|---|---|
| `INNGEST_EVENT_KEY` | Inngest event key (for sending events) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (for verifying Inngest → app webhooks) |

**Critical:** without both Inngest keys, **none of the cron jobs in section 3 will fire.** This is the single most likely reason for "data isn't updating" on a new environment.

### Privacy / behavior
| Var | Purpose | Default |
|---|---|---|
| `FINGERPRINT_SECRET` | HMAC salt for the privacy-first visitor fingerprint (DL-01 compliant) | required, no default |
| `INGEST_RATE_LIMIT_PER_MINUTE` | Per-IP ingestion rate limit | 100 |
| `DATA_RETENTION_DAYS` | Raw event retention before deletion | 90 |
| `DEMO_PASSWORD` | Override the default demo account password | `DemoPass2026!` |

### Optional / legacy
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog event forwarding (consent-aware) |
| `TWILIO_*` | SMS alerts (dependency installed but not yet wired) |
| `EMAIL_FROM` | Sender address for outgoing email |

---

## 2. External services that must exist before env vars matter

These are real-world prerequisites — not just config values.

| Service | What you have to do |
|---|---|
| **Supabase project** | Create project, get pooler + direct URLs, run `prisma db push` against it once to populate the schema. |
| **Google Cloud OAuth client** | Create project → APIs & Services → OAuth consent screen + Client ID. Authorize all redirect URIs (`<deploy-url>/api/auth/callback/google`, `<deploy-url>/api/gsc/callback`, `<deploy-url>/api/gads/callback`, `<deploy-url>/api/ga4/callback`). Enable APIs: Search Console, Google Analytics Admin/Data, Google Ads. |
| **Google Ads developer token** | Apply through Google Ads Tools → API Center. Approval can take 1–3 days for production-tier access. Test-tier is instant but only works against test accounts. |
| **Inngest account** | Sign up at inngest.com. Create an app in their dashboard. Configure the webhook URL: `<deploy-url>/api/inngest`. Inngest pings this URL to register your functions. **If the URL is wrong or unreachable, no crons fire.** |
| **Resend account** | Verify your sending domain (DNS records). Get API key. |
| **DataForSEO subscription** | Active subscription required for keyword volume in WebOpp. |
| **Anthropic account** | API key with sufficient credit. Report generation uses ~3 Claude calls per report. |

---

## 3. Inngest cron jobs (defined in `src/lib/jobs/inngest.ts`)

Every job that runs on a schedule. If Inngest isn't configured (section 1), none of these execute. After deploying, verify in the Inngest dashboard that all functions are registered and have run at least once.

### Daily
| Job ID | Cron (UTC) | What it does | Why it matters if it stops |
|---|---|---|---|
| `delete-old-events` | `0 2 * * *` | Deletes raw `SessionEvent` and `PageView` rows older than 90 days (DL-04 compliance) | Compliance violation — raw data piles up indefinitely |
| `annual-baseline-reset` | `0 3 * * *` | Captures a 365-day baseline for sites past their anniversary | Anniversary-based comparisons go stale |
| `webaudit-snapshot` | `0 4 * * *` | At Day 30 / Day 60 of a WebAudit, captures baseline + **generates an LLM report**. Day 60 expires the audit and flips tier to `WEBAUDIT_EXPIRED` | Day-30 / Day-60 reports never fire — users never get their scheduled deliverable |
| `sync-gsc-daily` | `0 6 * * *` | Pulls latest Google Search Console data for every `gscConnected=true` site | Top Keywords, organic sessions, impressions, position — ALL the SEO Performance card numbers — stay frozen at last successful sync |
| `run-daily-verification` | `0 7 * * *` | Evaluates pending re-measurement jobs (RM-01) | Recommendation verification (did the fix work?) doesn't update |
| `sync-gads-daily` | `0 7 * * *` | Pulls Google Ads campaign spend, clicks, impressions for every `gadsConnected=true` site | Paid traffic data goes stale; ROAS / wasted-spend math is wrong |
| `resolve-gclids-daily` | `0 8 * * *` | Resolves auto-tagged Google Ads visits (gclid → campaign name via `click_view`) | Auto-tagged paid traffic appears as `utm_campaign=NULL`; campaigns can't be attributed |
| `sync-ga4-daily` | `0 8 * * *` | Pulls daily GA4 metrics for every `ga4Connected=true` site | GA4 baseline numbers (sessions, conversions) stop updating |
| `flag-stale-utms-daily` | `0 9 * * *` | Compares observed `utm_campaign` values against active Ads campaigns; flags drift | Stale links circulating with retired campaign names go undetected |
| `run-alert-rules` | `0 * * * *` (hourly) | Evaluates all alert rules for every site; sends email/Slack | Alerts never deliver |

### Weekly
| Job ID | Cron (UTC) | What it does |
|---|---|---|
| `run-weekly-seo-crawl` | `0 3 * * 0` (Sun 3am) | Crawls every active site for SEO health (Puppeteer) |
| `send-weekly-digest` | `0 9 * * 1` (Mon 9am) | Emails OWNER/ADMIN of every WebWatch site |

### Monthly
| Job ID | Cron (UTC) | What it does |
|---|---|---|
| `webwatch-monthly-report` | `0 4 1 * *` (1st 4am) | Generates LLM report for every WebWatch site. First-month-mid-start sites get a `Partial 1st month` report. **Runs BEFORE the archive job below.** |
| `archive-monthly-report` | `0 5 2 * *` (2nd 5am) | Archives last month's report into `ArchivedReport` for historical viewing |
| `capture-monthly-baseline` | `0 2 1 * *` (1st 2am) | Captures previous-month KPI baseline for WebWatch / WEBWATCH_WEBOPP sites |

### Event-driven (not on a clock)
| Job ID | Trigger | What it does |
|---|---|---|
| `score-session-intent` | `webgrade/session.ended` event | Computes the 5-factor intent score for a session and persists it |
| `run-seo-crawl` | `webgrade/seo.crawl.requested` event | One-off SEO crawl for a specific site |

---

## 4. Per-site configuration

These are populated through the Settings UI (`/dashboard/[siteId]/settings`) — not env vars. After a Site row is created, an admin must walk through these to enable each integration. Without them, the daily cron jobs above will skip the site.

| Setting | Why | Verify via |
|---|---|---|
| `gscConnected = true` + `gscPropertyUrl` set | GSC sync skips the site if not connected | Settings page shows "Connected" badge with last-sync timestamp |
| `ga4Connected = true` + `ga4PropertyId` set | GA4 sync skips the site if not connected | Settings shows GA4 property ID |
| `gadsConnected = true` + `gadsCustomerId` set | Ads sync, gclid resolver, stale-UTM detection all skip otherwise | Settings shows Ads customer ID |
| `webauditStartDate` set | Day-30 / Day-60 report cron only fires on this anchor | Site page header shows "Day X of 60" |
| `webwatchStartDate` set (if on WebWatch tier) | Monthly report cron checks this for partial-first-month logic | Subscription banner shows start date |
| Snippet installed | No sessions = no behavioral data = nothing for any of the above to analyze | `/dashboard/[siteId]/snippet` page shows "Installed and firing" |

---

## 5. Quick verification checklist after deploy

Run through this in order on a new environment. Each step proves the layer below is working.

1. **App boots** — `<deploy-url>` returns 200 (not a 500 stack trace).
2. **DB connects** — sign in with Google, you reach the dashboard.
3. **Inngest registered** — open the Inngest dashboard. Every function listed in section 3 should appear under your app. If not: check `INNGEST_SIGNING_KEY` and the webhook URL.
4. **Cron functions show "Last run"** — wait for the next cron tick (worst case, 24h). Each daily cron should show a recent successful run.
5. **GSC / GA4 / GAds connect flow works** — settings page → click Connect → Google OAuth → returns to settings showing connected status.
6. **Snippet posts data** — install snippet on a test page, visit it, confirm a `VisitorSession` row appears in DB within ~5 sec.
7. **Drop-off analysis populates** — once a single page hits 10+ unique sessions, the dashboard's "Top Drop-Off Pages" populates automatically.
8. **Scheduled report fires** — fastest way to test: temporarily set a site's `webauditStartDate` to 30 days ago, run the `webaudit-snapshot` Inngest function manually. A `Report` record should appear with `status='COMPLETE'`.

If any step fails, fix that layer before troubleshooting anything above it.

---

## 6. The "two-database" workflow

WebGrade has a known dev setup where:
- Local development → connects to one Supabase via the local `.env`
- AWS staging → separate Supabase, separate Inngest app, separate Google OAuth client
- Vercel production → separate again (or shared with one of the above)

Each environment is independent. **All sections above must be configured per-environment.** If sections 1–4 are only set up on AWS, sections 1–4 must ALSO be set up on Vercel before webgrade.io shows real data, and vice-versa.

When migrating data between environments, copy the entire Supabase database (use Supabase's built-in dump/restore). The schema is identical between environments because both run from the same Prisma schema file.
