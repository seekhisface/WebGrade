-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "SitePlatform" AS ENUM ('WORDPRESS', 'WEBFLOW', 'SHOPIFY', 'SQUARESPACE', 'WIX', 'NEXT_JS', 'CUSTOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DataRegion" AS ENUM ('US', 'EU');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('WEBAUDIT', 'WEBAUDIT_EXPIRED', 'WEBWATCH', 'WEBWATCH_WEBOPP');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InstallMethod" AS ENUM ('GTM', 'WORDPRESS', 'WEBFLOW', 'SHOPIFY', 'CLOUDFLARE', 'MANUAL', 'BULK_CSV');

-- CreateEnum
CREATE TYPE "InstallStatus" AS ENUM ('PENDING', 'INSTALLED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "IntentClass" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'RESEARCHER', 'COMPETITOR', 'BOT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PAGE_VIEW', 'PAGE_EXIT', 'PAGE_LOAD_COMPLETE', 'SCROLL', 'CLICK', 'CTA_CLICK', 'NAV_CLICK', 'HESITATION', 'RAGE_CLICK', 'FORM_FOCUS', 'FORM_SUBMIT', 'CONVERSION', 'ROUTE_CHANGE', 'SECTION_VIEW', 'EXIT_INTENT', 'TAB_BLUR', 'TAB_FOCUS', 'COPY_TEXT', 'FILE_DOWNLOAD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('INTERIM', 'WEBWATCH', 'WEBOPP', 'WINBACK');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATING', 'COMPLETE', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ComparisonMode" AS ENUM ('VS_BASELINE', 'VS_PRIOR_YEAR', 'VS_PRIOR_MONTH');

-- CreateEnum
CREATE TYPE "SourceModule" AS ENUM ('BEHAVIORAL', 'SEO', 'AD_SPEND', 'WEBOPP', 'HEALTH_CHECK');

-- CreateEnum
CREATE TYPE "FixType" AS ENUM ('CONTENT', 'TECHNICAL', 'AD_SPEND', 'SEO', 'UX', 'TRACKING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ImplementationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'STALLED', 'ABANDONED', 'CONTRADICTION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'IMPROVED', 'PARTIAL', 'NO_CHANGE', 'REGRESSED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('CONVERSION_DROP', 'BOUNCE_RATE_SPIKE', 'INTENT_SCORE_DROP', 'TRAFFIC_ANOMALY', 'SEO_REGRESSION', 'NEW_CRITICAL_SEO_ISSUE', 'CRAWL_ERROR', 'WASTED_SPEND_DETECTED', 'ZERO_CONVERSION_CAMPAIGN', 'UTM_STRIPPING', 'NEW_HIGH_VALUE_OPPORTUNITY', 'COMPETITOR_ENTERED_CLUSTER', 'DEMAND_SPIKE', 'DEMAND_DECAY', 'SNIPPET_FIRING_STOPPED', 'CONVERSION_GOAL_UNREACHABLE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('PENDING', 'MEASURING', 'COMPLETE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('WORKED', 'PARTIAL', 'NO_CHANGE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "OpportunityDecision" AS ENUM ('YES', 'MAYBE', 'NO');

-- CreateEnum
CREATE TYPE "DistributionRole" AS ENUM ('OWNER', 'STAKEHOLDER', 'EXEC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_PUBLISH');

-- CreateEnum
CREATE TYPE "DistributionChannel" AS ENUM ('EMAIL', 'SLACK', 'BOTH');

-- CreateEnum
CREATE TYPE "RetentionTargetType" AS ENUM ('PROSPECT', 'TRIAL_USER', 'CUSTOMER', 'CHURNED', 'LAPSED');

-- CreateEnum
CREATE TYPE "RetentionTriggerType" AS ENUM ('METRIC_IMPROVEMENT', 'NEW_OPPORTUNITY', 'MILESTONE_HIT', 'DORMANT_REACTIVATION', 'COMPETITOR_SIGNAL', 'BENCHMARK_GAP_WIDENING', 'REPORT_READY');

-- CreateEnum
CREATE TYPE "RetentionSequenceStatus" AS ENUM ('WATCHING', 'QUALIFYING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'UNSUBSCRIBED', 'CONVERTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "hashedPassword" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_invitations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "SitePlatform",
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "industry" TEXT,
    "description" TEXT,
    "dataRegion" "DataRegion" NOT NULL DEFAULT 'US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasInterimReport" BOOLEAN NOT NULL DEFAULT false,
    "hasWebWatch" BOOLEAN NOT NULL DEFAULT false,
    "hasWebOpp" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'WEBAUDIT',
    "webauditStartDate" TIMESTAMP(3),
    "webauditEndDate" TIMESTAMP(3),
    "webwatchStartDate" TIMESTAMP(3),
    "baselineResetDate" TIMESTAMP(3),
    "posthogEnabled" BOOLEAN NOT NULL DEFAULT false,
    "posthogApiKey" TEXT,
    "gscConnected" BOOLEAN NOT NULL DEFAULT false,
    "gscPropertyUrl" TEXT,
    "gscConnectedAt" TIMESTAMP(3),
    "gscLastSyncAt" TIMESTAMP(3),
    "gscConnectedByUserId" TEXT,
    "snippetId" TEXT NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archived_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kpiSnapshot" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_onboardings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "conversionGoalUrl" TEXT,
    "conversionGoalName" TEXT,
    "businessDescription" TEXT,
    "targetAudience" TEXT,
    "primaryValueProp" TEXT,
    "currentPainPoints" TEXT,
    "competitorUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ga4PropertyId" TEXT,
    "ga4AccessToken" TEXT,
    "ga4RefreshToken" TEXT,
    "ga4BaselineImportedAt" TIMESTAMP(3),
    "monthlyAdSpend" DOUBLE PRECISION,
    "averageOrderValue" DOUBLE PRECISION,
    "leadToWinRate" DOUBLE PRECISION,
    "conversionRate" DOUBLE PRECISION,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedSteps" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "skippedSetupItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_baselines" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "competitorUrl" TEXT NOT NULL,
    "aboveFold" TEXT,
    "ctaText" TEXT,
    "pricingFound" BOOLEAN NOT NULL DEFAULT false,
    "pageSpeedScore" DOUBLE PRECISION,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_health_checks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snippetFires" BOOLEAN,
    "snippetFireTimeMs" INTEGER,
    "snippetStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "spaFramework" TEXT,
    "spaRouteEventsWork" BOOLEAN,
    "spaStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "conversionGoalReachable" BOOLEAN,
    "conversionGoalSnippetFires" BOOLEAN,
    "conversionGoalStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "utmPreservedToGoal" BOOLEAN,
    "utmStrippingDetected" BOOLEAN,
    "utmStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "duplicateSnippetCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consentBannerDetected" BOOLEAN,
    "consentBlocksSnippet" BOOLEAN,
    "consentStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "estimatedBotPercent" DOUBLE PRECISION,
    "botStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lighthouseLcp" DOUBLE PRECISION,
    "lighthouseFid" DOUBLE PRECISION,
    "lighthouseCls" DOUBLE PRECISION,
    "lighthouseScore" INTEGER,
    "pageSpeedStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "overallStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "fixInstructions" JSONB,

    CONSTRAINT "site_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_installations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "method" "InstallMethod",
    "status" "InstallStatus" NOT NULL DEFAULT 'PENDING',
    "installedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "gtmContainerId" TEXT,
    "gtmWorkspaceId" TEXT,
    "gtmTagId" TEXT,
    "platformAccessToken" TEXT,
    "platformRefreshToken" TEXT,
    "platformMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_sessions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "clickId" TEXT,
    "clickIdType" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "trafficSource" TEXT,
    "isReturning" BOOLEAN NOT NULL DEFAULT false,
    "intentScore" INTEGER,
    "intentClass" "IntentClass",
    "isBotFiltered" BOOLEAN NOT NULL DEFAULT false,
    "botReason" TEXT,
    "botCategory" TEXT,
    "isBotSuspect" BOOLEAN NOT NULL DEFAULT false,
    "botSuspectReason" TEXT,
    "isBounce" BOOLEAN NOT NULL DEFAULT false,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "entryPage" TEXT,
    "exitPage" TEXT,
    "convertedAt" TIMESTAMP(3),
    "conversionGoalHit" BOOLEAN NOT NULL DEFAULT false,
    "adSourceId" TEXT,

    CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrollDepthPct" INTEGER,
    "elementTag" TEXT,
    "elementText" TEXT,
    "elementClass" TEXT,
    "isCtaClick" BOOLEAN NOT NULL DEFAULT false,
    "hesitationMs" INTEGER,
    "rageClickCount" INTEGER,
    "timeOnPageMs" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "timeOnPageMs" INTEGER,
    "maxScrollDepthPct" INTEGER,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "rageClickCount" INTEGER NOT NULL DEFAULT 0,
    "hesitationCount" INTEGER NOT NULL DEFAULT 0,
    "isExit" BOOLEAN NOT NULL DEFAULT false,
    "exitIntentDetected" BOOLEAN NOT NULL DEFAULT false,
    "isDropOffPage" BOOLEAN NOT NULL DEFAULT false,
    "storylineBreakpoint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_crawls" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "pagesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "crawlStatus" "CrawlStatus" NOT NULL DEFAULT 'RUNNING',
    "overallSeoScore" INTEGER,
    "technicalScore" INTEGER,
    "onPageScore" INTEGER,
    "contentScore" INTEGER,
    "crawlabilityScore" INTEGER,

    CONSTRAINT "seo_crawls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_page_results" (
    "id" TEXT NOT NULL,
    "crawlId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "redirectChain" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canonicalUrl" TEXT,
    "lcp" DOUBLE PRECISION,
    "fid" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "ttfb" DOUBLE PRECISION,
    "mobileScore" INTEGER,
    "desktopScore" INTEGER,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescLength" INTEGER,
    "h1Count" INTEGER,
    "h1Text" TEXT,
    "h2Count" INTEGER,
    "altTextMissing" INTEGER,
    "internalLinks" INTEGER,
    "externalLinks" INTEGER,
    "wordCount" INTEGER,
    "onPageScore" INTEGER,
    "isMobileResponsive" BOOLEAN,
    "renderBlockingScripts" INTEGER,
    "hasStructuredData" BOOLEAN,
    "jsRenderRequired" BOOLEAN,
    "frameworkDetected" TEXT,
    "isIndexable" BOOLEAN,
    "hasNoindex" BOOLEAN,
    "robotsTxtBlocked" BOOLEAN,
    "isInSitemap" BOOLEAN,
    "crawlDepth" INTEGER,
    "isOrphanPage" BOOLEAN,
    "contentScore" INTEGER,
    "searchIntentMatch" DOUBLE PRECISION,
    "isThinContent" BOOLEAN,
    "isOutdated" BOOLEAN,
    "issues" JSONB[] DEFAULT ARRAY[]::JSONB[],

    CONSTRAINT "seo_page_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_keyword_rankings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "crawlId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "keyword" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intent" TEXT NOT NULL DEFAULT 'Commercial',
    "description" TEXT,
    "positionDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trend" TEXT NOT NULL DEFAULT 'flat',

    CONSTRAINT "seo_keyword_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_traffic_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "organicSessions" INTEGER NOT NULL DEFAULT 0,
    "organicPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indexedPages" INTEGER NOT NULL DEFAULT 0,
    "crawlErrors" INTEGER NOT NULL DEFAULT 0,
    "notIndexed" INTEGER NOT NULL DEFAULT 0,
    "newPagesFound" INTEGER NOT NULL DEFAULT 0,
    "keywordsTop3" INTEGER NOT NULL DEFAULT 0,
    "keywordsTop10" INTEGER NOT NULL DEFAULT 0,
    "keywordsTop30" INTEGER NOT NULL DEFAULT 0,
    "keywordsTotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "seo_traffic_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sources" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "campaign" TEXT,
    "term" TEXT,
    "content" TEXT,
    "qualityScore" INTEGER,
    "avgIntentScore" DOUBLE PRECISION,
    "avgScrollDepth" DOUBLE PRECISION,
    "conversionRate" DOUBLE PRECISION,
    "has404LandingPage" BOOLEAN NOT NULL DEFAULT false,
    "hasSlowLandingPage" BOOLEAN NOT NULL DEFAULT false,
    "hasZeroConversions" BOOLEAN NOT NULL DEFAULT false,
    "estimatedWastedSpend" DOUBLE PRECISION,
    "platformSpend" DOUBLE PRECISION,
    "platformImpressions" INTEGER,
    "platformClicks" INTEGER,
    "platformCpc" DOUBLE PRECISION,
    "intentByHour" JSONB,
    "conversionByHour" JSONB,
    "landingPageUrl" TEXT,
    "landingPageAlignScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDiff" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "behavioralSummary" TEXT,
    "adSpendSummary" TEXT,
    "totalWastedSpend" DOUBLE PRECISION,
    "seoScore" INTEGER,
    "seoIssueCount" INTEGER,
    "seoSummary" TEXT,
    "executiveSummary" TEXT,
    "topFindings" JSONB,
    "topRecommendations" JSONB,
    "estimatedImpact" TEXT,
    "pdfUrl" TEXT,
    "pdfGenAt" TIMESTAMP(3),
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "shareUnlockedAt" TIMESTAMP(3),
    "shareRecipient" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_ideas" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "hypothesis" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "successMetric" TEXT NOT NULL,
    "estimatedLift" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_performance_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reportId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "comparisonMode" "ComparisonMode" NOT NULL DEFAULT 'VS_BASELINE',
    "baselineLabel" TEXT,
    "priorPeriodLabel" TEXT,
    "executiveNarrative" TEXT NOT NULL,
    "praisePoints" JSONB,
    "concernPoints" JSONB,
    "topOpportunities" JSONB,
    "contradictions" JSONB,
    "sessionsThisMonth" DOUBLE PRECISION,
    "sessionsBaseline" DOUBLE PRECISION,
    "sessionsMoM" DOUBLE PRECISION,
    "sessionsPctBaseline" DOUBLE PRECISION,
    "intentScoreNow" DOUBLE PRECISION,
    "intentScoreBaseline" DOUBLE PRECISION,
    "intentScoreMoM" DOUBLE PRECISION,
    "conversionRateNow" DOUBLE PRECISION,
    "conversionRateBaseline" DOUBLE PRECISION,
    "revenueAtRiskNow" DOUBLE PRECISION,
    "revenueRecoveredTotal" DOUBLE PRECISION,
    "totalRecs" INTEGER NOT NULL DEFAULT 0,
    "verifiedFixed" INTEGER NOT NULL DEFAULT 0,
    "inProgress" INTEGER NOT NULL DEFAULT 0,
    "stalled" INTEGER NOT NULL DEFAULT 0,
    "contradictions2" INTEGER NOT NULL DEFAULT 0,
    "openUnacted" INTEGER NOT NULL DEFAULT 0,
    "performanceGrade" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_performance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reportId" TEXT,
    "sourceModule" "SourceModule" NOT NULL,
    "title" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "fixAction" TEXT NOT NULL,
    "expectedResult" TEXT,
    "impactScore" INTEGER NOT NULL,
    "effortScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "fixType" "FixType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "assignee" TEXT,
    "completedAt" TIMESTAMP(3),
    "linearIssueId" TEXT,
    "jiraIssueId" TEXT,
    "asanaTaskId" TEXT,
    "notionPageId" TEXT,
    "implementationStatus" "ImplementationStatus" NOT NULL DEFAULT 'OPEN',
    "customerNote" TEXT,
    "customerUpdatedAt" TIMESTAMP(3),
    "baselineMetricKey" TEXT,
    "baselineMetricValue" DOUBLE PRECISION,
    "baselineMetricLabel" TEXT,
    "targetMetricValue" DOUBLE PRECISION,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerifiedValue" DOUBLE PRECISION,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT,
    "contradictionFlag" BOOLEAN NOT NULL DEFAULT false,
    "contradictionNote" TEXT,
    "metricHistory" JSONB,
    "estimatedMonthlyImpact" DOUBLE PRECISION,
    "recoveredMonthlyValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "productModule" "SourceModule" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAutomatically" BOOLEAN NOT NULL DEFAULT false,
    "resolutionTimeMs" INTEGER,
    "emailSentAt" TIMESTAMP(3),
    "slackSentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_settings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "AlertSeverity" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slackChannel" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "alert_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_jobs" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productModule" "SourceModule" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measureAfterDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "MeasurementStatus" NOT NULL DEFAULT 'PENDING',
    "beforeValue" DOUBLE PRECISION,
    "afterValue" DOUBLE PRECISION,
    "changePct" DOUBLE PRECISION,
    "isSignificant" BOOLEAN,
    "sampleSize" INTEGER,
    "resultType" "ResultType",
    "narrative" TEXT,

    CONSTRAINT "measurement_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksWorked" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "conversionLiftPct" DOUBLE PRECISION,
    "estimatedSpendSaved" DOUBLE PRECISION,
    "estimatedRevenueCaptured" DOUBLE PRECISION,
    "summary" TEXT,
    "sentAt" TIMESTAMP(3),
    "emailedTo" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webopp_analyses" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalMissedLeadsPerMonth" INTEGER,
    "totalMissedRevenuePerMonth" DOUBLE PRECISION,
    "totalOpportunitiesFound" INTEGER,
    "topOpportunityCluster" TEXT,

    CONSTRAINT "webopp_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webopp_keyword_clusters" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "clusterName" TEXT NOT NULL,
    "keywords" TEXT[],
    "primaryKeyword" TEXT NOT NULL,
    "monthlySearchVolume" INTEGER,
    "competition" DOUBLE PRECISION,
    "avgCpc" DOUBLE PRECISION,
    "source" TEXT,
    "currentRankPosition" INTEGER,
    "currentMonthlyClicks" INTEGER,
    "visibilityScore" DOUBLE PRECISION,
    "topCompetitorUrl" TEXT,
    "competitorRankPosition" INTEGER,
    "isCompetitorKeyword" BOOLEAN NOT NULL DEFAULT false,
    "missedImpressions" INTEGER,
    "missedClicks" INTEGER,
    "missedLeads" INTEGER,
    "missedRevenue" DOUBLE PRECISION,
    "competitionDifficulty" INTEGER,
    "monthsToRank" INTEGER,
    "estimatedCpaForPaid" DOUBLE PRECISION,
    "roiPotential" DOUBLE PRECISION,
    "decision" "OpportunityDecision",
    "isLocalKeyword" BOOLEAN NOT NULL DEFAULT false,
    "localProximityRank" INTEGER,
    "hasHighVideoIntent" BOOLEAN NOT NULL DEFAULT false,
    "youtubeSearchVolume" INTEGER,

    CONSTRAINT "webopp_keyword_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webopp_budget_models" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "currentMonthlySpend" DOUBLE PRECISION,
    "recommendedMonthlySpend" DOUBLE PRECISION,
    "maxMarketSpend" DOUBLE PRECISION,
    "expectedLeads" INTEGER,
    "expectedWins" INTEGER,
    "expectedRevenue" DOUBLE PRECISION,
    "roiTimeline" INTEGER,
    "breakEvenMonths" INTEGER,
    "stairStepPlan" JSONB,

    CONSTRAINT "webopp_budget_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_volume_cache" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2840,
    "monthlySearchVolume" INTEGER NOT NULL,
    "competition" DOUBLE PRECISION NOT NULL,
    "avgCpc" DOUBLE PRECISION NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_volume_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "siteId" TEXT,
    "keywordsQueried" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "website" TEXT,
    "message" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_distributions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "role" "DistributionRole" NOT NULL DEFAULT 'STAKEHOLDER',
    "receiveInterimReport" BOOLEAN NOT NULL DEFAULT true,
    "receiveWebWatch" BOOLEAN NOT NULL DEFAULT true,
    "receiveWebOpp" BOOLEAN NOT NULL DEFAULT false,
    "receiveWeeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "receiveAlerts" BOOLEAN NOT NULL DEFAULT false,
    "webWatchFrequency" "DigestFrequency" NOT NULL DEFAULT 'MONTHLY',
    "digestDay" INTEGER,
    "digestHour" INTEGER NOT NULL DEFAULT 8,
    "customMessage" TEXT,
    "deliveryChannel" "DistributionChannel" NOT NULL DEFAULT 'EMAIL',
    "slackWebhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snippet_retention_targets" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sessionFingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "highestIntentScore" INTEGER,
    "pagesVisited" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reachedPricing" BOOLEAN NOT NULL DEFAULT false,
    "reachedSignup" BOOLEAN NOT NULL DEFAULT false,
    "exitedAtSignup" BOOLEAN NOT NULL DEFAULT false,
    "conversionGoalHit" BOOLEAN NOT NULL DEFAULT false,
    "totalSessionsCount" INTEGER NOT NULL DEFAULT 1,
    "targetType" "RetentionTargetType" NOT NULL DEFAULT 'PROSPECT',
    "customerId" TEXT,
    "triggerType" "RetentionTriggerType",
    "triggerFiredAt" TIMESTAMP(3),
    "triggerPayload" JSONB,
    "sequenceStatus" "RetentionSequenceStatus" NOT NULL DEFAULT 'WATCHING',
    "sequenceStep" INTEGER NOT NULL DEFAULT 0,
    "lastContactedAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "reEngaged" BOOLEAN NOT NULL DEFAULT false,
    "reEngagedAt" TIMESTAMP(3),
    "convertedFromRetention" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snippet_retention_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dpa_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "dpaVersion" TEXT NOT NULL DEFAULT '1.0',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT NOT NULL,

    CONSTRAINT "dpa_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "deletionType" TEXT NOT NULL,
    "recordsDeleted" INTEGER NOT NULL,
    "periodCovered" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_retention_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_orgId_userId_key" ON "org_members"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_invitations_token_key" ON "org_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "org_invitations_orgId_email_key" ON "org_invitations"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sites_snippetId_key" ON "sites"("snippetId");

-- CreateIndex
CREATE INDEX "sites_orgId_idx" ON "sites"("orgId");

-- CreateIndex
CREATE INDEX "sites_domain_idx" ON "sites"("domain");

-- CreateIndex
CREATE INDEX "archived_reports_siteId_createdAt_idx" ON "archived_reports"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "site_onboardings_siteId_key" ON "site_onboardings"("siteId");

-- CreateIndex
CREATE INDEX "site_baselines_siteId_metricKey_idx" ON "site_baselines"("siteId", "metricKey");

-- CreateIndex
CREATE INDEX "competitor_snapshots_siteId_idx" ON "competitor_snapshots"("siteId");

-- CreateIndex
CREATE INDEX "site_health_checks_siteId_checkedAt_idx" ON "site_health_checks"("siteId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "site_installations_siteId_key" ON "site_installations"("siteId");

-- CreateIndex
CREATE INDEX "visitor_sessions_siteId_startedAt_idx" ON "visitor_sessions"("siteId", "startedAt");

-- CreateIndex
CREATE INDEX "visitor_sessions_siteId_intentClass_idx" ON "visitor_sessions"("siteId", "intentClass");

-- CreateIndex
CREATE INDEX "visitor_sessions_siteId_isBotFiltered_idx" ON "visitor_sessions"("siteId", "isBotFiltered");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_sessions_siteId_sessionId_key" ON "visitor_sessions"("siteId", "sessionId");

-- CreateIndex
CREATE INDEX "session_events_sessionId_idx" ON "session_events"("sessionId");

-- CreateIndex
CREATE INDEX "session_events_siteId_eventType_timestamp_idx" ON "session_events"("siteId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "page_views_siteId_url_idx" ON "page_views"("siteId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "page_views_sessionId_siteId_url_key" ON "page_views"("sessionId", "siteId", "url");

-- CreateIndex
CREATE INDEX "seo_crawls_siteId_startedAt_idx" ON "seo_crawls"("siteId", "startedAt");

-- CreateIndex
CREATE INDEX "seo_page_results_crawlId_idx" ON "seo_page_results"("crawlId");

-- CreateIndex
CREATE INDEX "seo_page_results_siteId_url_idx" ON "seo_page_results"("siteId", "url");

-- CreateIndex
CREATE INDEX "seo_keyword_rankings_siteId_date_idx" ON "seo_keyword_rankings"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "seo_keyword_rankings_siteId_keyword_date_key" ON "seo_keyword_rankings"("siteId", "keyword", "date");

-- CreateIndex
CREATE INDEX "seo_traffic_snapshots_siteId_date_idx" ON "seo_traffic_snapshots"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "seo_traffic_snapshots_siteId_date_key" ON "seo_traffic_snapshots"("siteId", "date");

-- CreateIndex
CREATE INDEX "ad_sources_siteId_idx" ON "ad_sources"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sources_siteId_source_medium_campaign_key" ON "ad_sources"("siteId", "source", "medium", "campaign");

-- CreateIndex
CREATE UNIQUE INDEX "reports_shareToken_key" ON "reports"("shareToken");

-- CreateIndex
CREATE INDEX "reports_siteId_createdAt_idx" ON "reports"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "monthly_performance_reports_siteId_year_month_idx" ON "monthly_performance_reports"("siteId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_performance_reports_siteId_year_month_key" ON "monthly_performance_reports"("siteId", "year", "month");

-- CreateIndex
CREATE INDEX "recommendations_siteId_priorityScore_idx" ON "recommendations"("siteId", "priorityScore");

-- CreateIndex
CREATE INDEX "recommendations_siteId_status_idx" ON "recommendations"("siteId", "status");

-- CreateIndex
CREATE INDEX "recommendations_siteId_implementationStatus_idx" ON "recommendations"("siteId", "implementationStatus");

-- CreateIndex
CREATE INDEX "alerts_siteId_triggeredAt_idx" ON "alerts"("siteId", "triggeredAt");

-- CreateIndex
CREATE INDEX "alerts_siteId_alertType_resolvedAt_idx" ON "alerts"("siteId", "alertType", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "alert_settings_siteId_alertType_key" ON "alert_settings"("siteId", "alertType");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_jobs_recommendationId_key" ON "measurement_jobs"("recommendationId");

-- CreateIndex
CREATE INDEX "measurement_jobs_siteId_status_idx" ON "measurement_jobs"("siteId", "status");

-- CreateIndex
CREATE INDEX "impact_reports_siteId_period_idx" ON "impact_reports"("siteId", "period");

-- CreateIndex
CREATE INDEX "webopp_analyses_siteId_idx" ON "webopp_analyses"("siteId");

-- CreateIndex
CREATE INDEX "webopp_keyword_clusters_analysisId_idx" ON "webopp_keyword_clusters"("analysisId");

-- CreateIndex
CREATE INDEX "webopp_keyword_clusters_siteId_decision_idx" ON "webopp_keyword_clusters"("siteId", "decision");

-- CreateIndex
CREATE INDEX "webopp_budget_models_analysisId_idx" ON "webopp_budget_models"("analysisId");

-- CreateIndex
CREATE INDEX "keyword_volume_cache_keyword_idx" ON "keyword_volume_cache"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_volume_cache_keyword_locationCode_key" ON "keyword_volume_cache"("keyword", "locationCode");

-- CreateIndex
CREATE INDEX "api_usage_logs_provider_calledAt_idx" ON "api_usage_logs"("provider", "calledAt");

-- CreateIndex
CREATE INDEX "contact_inquiries_email_idx" ON "contact_inquiries"("email");

-- CreateIndex
CREATE INDEX "report_distributions_siteId_idx" ON "report_distributions"("siteId");

-- CreateIndex
CREATE INDEX "report_distributions_orgId_idx" ON "report_distributions"("orgId");

-- CreateIndex
CREATE INDEX "snippet_retention_targets_siteId_targetType_idx" ON "snippet_retention_targets"("siteId", "targetType");

-- CreateIndex
CREATE INDEX "snippet_retention_targets_siteId_sequenceStatus_idx" ON "snippet_retention_targets"("siteId", "sequenceStatus");

-- CreateIndex
CREATE INDEX "snippet_retention_targets_siteId_nextContactAt_idx" ON "snippet_retention_targets"("siteId", "nextContactAt");

-- CreateIndex
CREATE UNIQUE INDEX "dpa_acceptances_userId_siteId_dpaVersion_key" ON "dpa_acceptances"("userId", "siteId", "dpaVersion");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archived_reports" ADD CONSTRAINT "archived_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_onboardings" ADD CONSTRAINT "site_onboardings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_baselines" ADD CONSTRAINT "site_baselines_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_health_checks" ADD CONSTRAINT "site_health_checks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_installations" ADD CONSTRAINT "site_installations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_adSourceId_fkey" FOREIGN KEY ("adSourceId") REFERENCES "ad_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visitor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visitor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_crawls" ADD CONSTRAINT "seo_crawls_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_page_results" ADD CONSTRAINT "seo_page_results_crawlId_fkey" FOREIGN KEY ("crawlId") REFERENCES "seo_crawls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_page_results" ADD CONSTRAINT "seo_page_results_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_keyword_rankings" ADD CONSTRAINT "seo_keyword_rankings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_keyword_rankings" ADD CONSTRAINT "seo_keyword_rankings_crawlId_fkey" FOREIGN KEY ("crawlId") REFERENCES "seo_crawls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_traffic_snapshots" ADD CONSTRAINT "seo_traffic_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sources" ADD CONSTRAINT "ad_sources_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_ideas" ADD CONSTRAINT "ab_test_ideas_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_performance_reports" ADD CONSTRAINT "monthly_performance_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_performance_reports" ADD CONSTRAINT "monthly_performance_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_settings" ADD CONSTRAINT "alert_settings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_jobs" ADD CONSTRAINT "measurement_jobs_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_jobs" ADD CONSTRAINT "measurement_jobs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_reports" ADD CONSTRAINT "impact_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webopp_analyses" ADD CONSTRAINT "webopp_analyses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webopp_keyword_clusters" ADD CONSTRAINT "webopp_keyword_clusters_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "webopp_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webopp_keyword_clusters" ADD CONSTRAINT "webopp_keyword_clusters_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webopp_budget_models" ADD CONSTRAINT "webopp_budget_models_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "webopp_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_distributions" ADD CONSTRAINT "report_distributions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_distributions" ADD CONSTRAINT "report_distributions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snippet_retention_targets" ADD CONSTRAINT "snippet_retention_targets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpa_acceptances" ADD CONSTRAINT "dpa_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpa_acceptances" ADD CONSTRAINT "dpa_acceptances_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_logs" ADD CONSTRAINT "data_retention_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
