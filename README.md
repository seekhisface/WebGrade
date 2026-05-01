# WebGrade — Website Intelligence Platform

**WebGrade Interim Report™ · WebWatch™ · WebOpp™**

> Marketing intelligence for founders who are tired of flying blind.

---

## What This Is

WebGrade is a three-product website intelligence platform:

| Product | Type | Price |
|---|---|---|
| **WebGrade Interim Report™** | One-time 45-day forensic audit | $5,000 fixed fee |
| **WebWatch™** | Always-on SaaS monitoring | Monthly subscription |
| **WebOpp™** | External market intelligence | One-time or SaaS add-on |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma |
| Background jobs | Inngest |
| Behavioral tracking | PostHog |
| AI | Anthropic Claude API |
| Email | Resend |
| Deployment | Vercel |

---

## First-Time Setup

### 1. Clone and install
```bash
git clone <your-repo>
cd webgrade
npm install
```

### 2. Copy environment variables
```bash
cp .env.example .env.local
```
Fill in every value in `.env.local` before continuing.

### 3. Set up the database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

See `.env.example` for the full list. Required at minimum:

- `DATABASE_URL` — Supabase connection string (from Supabase dashboard → Settings → Database)
- `DIRECT_URL` — Supabase direct connection string
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — From console.anthropic.com
- `NEXTAUTH_SECRET` — Run `openssl rand -base64 32` to generate

---

## Build Order (Follow This Exactly)

The 108-task build is organized into stages. Always follow this order:

### Stage 0 — Legal (BEFORE ANY DATA)
- [x] **DL-01** IP anonymization on ingestion ← **DONE — see `src/lib/tracking/anonymize.ts`**

### Stage 1 — Foundation
- [x] **P1-01** Project scaffold ← **DONE — this repo**
- [x] **P1-02** Prisma schema ← **DONE — see `prisma/schema.prisma`**
- [x] **OB-01** Onboarding form UI ← **DONE — see `src/app/onboarding/`**
- [x] **P1-03** Tracking snippet ← **DONE — see `public/snippet/webgrade.js`**
- [x] **P1-04** Server-side ingestion API ← **DONE — see `src/app/api/ingest/`**
- [x] **OB-02** site_baselines table ← **DONE — in Prisma schema**
- [x] **HC-01** Snippet fire detection ← **DONE — see `src/app/api/health-check/`**
- [x] **HC-03** Conversion goal reachability ← **DONE — see `src/app/api/health-check/`**

### Stage 2 — Behavioral + SEO (parallel)
- [ ] **P1-05** Bot filtering
- [ ] **P1-06** Intent scoring engine
- [ ] **P1-07** Drop-off analysis
- [ ] **P1-08** Behavioral dashboard UI
- [ ] **P1-09** AI explanation API
- [ ] **P2-01** Puppeteer crawler
- [ ] *(continues — see task estimates doc)*

### WebOpp™ Standalone (parallel with Stage 2)
- [ ] **WO-01** Search demand aggregator
- [ ] **WO-02** Competitor keyword gap engine
- [ ] *(continues — see task estimates doc)*

---

## Project Structure

```
webgrade/
├── prisma/
│   └── schema.prisma          # Complete database schema (all 108 task models)
├── public/
│   └── snippet/
│       └── webgrade.js        # Client-side tracking snippet (~7KB gzipped over the wire)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ingest/        # Event ingestion endpoint
│   │   │   ├── health-check/  # Site health check API
│   │   │   └── onboarding/    # Onboarding data API
│   │   ├── dashboard/         # Main app dashboard
│   │   ├── onboarding/        # Multi-step onboarding flow
│   │   └── (auth)/            # Auth pages
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   ├── dashboard/         # Dashboard-specific components
│   │   └── onboarding/        # Onboarding step components
│   ├── lib/
│   │   ├── db/                # Prisma client + queries
│   │   ├── tracking/          # Anonymization, bot detection, intent scoring
│   │   ├── ai/                # Claude API integration
│   │   └── utils/             # Shared utilities
│   └── types/                 # TypeScript type definitions
└── docs/
    └── architecture.md        # Architecture decisions
```

---

## Key Decisions

**Why IP hashing first?** DL-01 is a legal non-negotiable. Raw IPs must never be written to the database. The anonymization function runs synchronously on the ingestion API before any database write.

**Why Inngest?** Background jobs with retry logic, failure alerts, and a monitoring dashboard. All async tasks (crawls, AI generation, re-measurement) run through Inngest.

**Why PostHog?** The tracking snippet pipes events to PostHog's pipeline for behavioral analysis. WebGrade sits on top of PostHog data and adds AI-powered interpretation.

---

## Deploying to Vercel

```bash
vercel --prod
```

Set all environment variables in Vercel dashboard → Settings → Environment Variables.

---

*Built with Claude Code (Ralph build loop) · March 2026*
