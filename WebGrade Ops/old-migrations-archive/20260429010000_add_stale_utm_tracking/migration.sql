-- AlterTable
ALTER TABLE "visitor_sessions"
  ADD COLUMN "utmCampaignIsStale" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stale_utm_campaigns" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "sessionsAffected" INTEGER NOT NULL DEFAULT 0,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topLandingPage" TEXT,

    CONSTRAINT "stale_utm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stale_utm_campaigns_siteId_utmCampaign_key"
  ON "stale_utm_campaigns"("siteId", "utmCampaign");

-- CreateIndex
CREATE INDEX "stale_utm_campaigns_siteId_lastSeenAt_idx"
  ON "stale_utm_campaigns"("siteId", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "stale_utm_campaigns"
  ADD CONSTRAINT "stale_utm_campaigns_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
