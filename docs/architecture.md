# WebGrade Architecture Decisions

## Overview

WebGrade is a Next.js 14 application using the App Router. All three products (Interim Report™, WebWatch™, WebOpp™) live in the same codebase and share the same database schema.

---

## Key Decisions

### Why everything in one repo?

The three products share significant infrastructure: the tracking snippet, the Prisma schema, the auth system, the AI explanation layer, and the alert system. Separating them would create duplication without benefit at this stage. Product boundaries are enforced at the feature-flag level (`site.hasWebWatch`, `site.hasWebOpp`, etc.).

### Why Next.js 14 App Router?

Server Components let us fetch data directly from the database on the server without an extra API round-trip. This matters for dashboard performance. The App Router also makes it easy to create API routes (`/api/ingest`, `/api/health-check`) alongside the UI in the same project.

### Why Supabase + Prisma?

Supabase provides the hosted PostgreSQL database with good free tier limits. Prisma provides type-safe database access and migration management. We use Prisma's `prisma db push` for schema changes in early development and `prisma migrate dev` for production migrations.

### Why PostHog?

The tracking snippet pipes raw events to PostHog's pipeline. WebGrade sits on top of PostHog data and adds AI-powered interpretation. This separation means:
1. Raw event storage is handled by PostHog (not us — lower cost, battle-tested)
2. We store derived data (intent scores, sessions, aggregates) in our own DB
3. PostHog's funnel analysis can be used as a sanity check

### Why Inngest?

Background jobs with automatic retry logic, failure alerts, and a monitoring dashboard. All async tasks run through Inngest:
- Intent scoring (runs after session ends)
- SEO crawls (scheduled weekly)
- Alert evaluation (scheduled hourly)
- Data retention deletion (scheduled daily)
- Report generation (triggered by user action)

### IP Anonymization (DL-01)

Raw IPs are **never** written to the database. The `anonymizeRequest()` function in `src/lib/tracking/anonymize.ts` must be called at the top of every ingestion handler before any database write. This is a legal non-negotiable.

What we store:
- `ipHash`: SHA-256 of (ip + site-specific salt). One-way. Cannot be reversed.
- `country`: Derived from Vercel's geo headers. IP is not needed.
- `region`: Same.

### Rate Limiting

The ingestion API uses in-memory rate limiting in development. In production, replace with Upstash Redis for distributed rate limiting. The `checkRateLimit()` function in `src/lib/utils/rate-limit.ts` has the same interface for both implementations.

---

## Data Flow

```
Browser (snippet) → POST /api/ingest → anonymize IP → validate → write to DB → forward to PostHog
                                                                ↓
                                                    Inngest: score-session-intent
                                                                ↓
                                                    VisitorSession.intentScore + intentClass
                                                                ↓
                                                    Dashboard / Reports / Alerts
```

---

## Environment Setup Checklist

Run in this order:
1. Create Supabase project → copy DATABASE_URL and DIRECT_URL
2. Set up Google OAuth in Google Cloud Console → copy CLIENT_ID and SECRET
3. Create Anthropic API key → copy ANTHROPIC_API_KEY
4. Create PostHog project → copy POSTHOG_KEY
5. Create Inngest account → copy EVENT_KEY and SIGNING_KEY
6. Create Resend account → copy RESEND_API_KEY
7. Run `npx prisma db push` to create schema in Supabase
8. Run `npm run dev`

---

## Build Stage Sequencing

### Why DL-01 comes first
IP anonymization must be implemented and tested before any data collection starts. Running even a single test with raw IP storage violates GDPR. This is why DL-01 is listed first in the Fast Path.

### Why onboarding comes before behavioral tracking
Every AI insight is grounded in business context from the onboarding form (OB-05: context injection). Without the conversion goal URL, intent scoring has no target. Without the business description, AI explanations are generic.

### Why health checks come before the behavioral dashboard
The health check validates that the snippet is firing correctly before any data is trusted. Showing a dashboard based on misconfigured tracking is worse than showing no dashboard.
