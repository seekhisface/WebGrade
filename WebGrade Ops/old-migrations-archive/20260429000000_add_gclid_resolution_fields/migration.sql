-- AlterTable
ALTER TABLE "visitor_sessions"
  ADD COLUMN "resolvedCampaignId" TEXT,
  ADD COLUMN "resolvedCampaignName" TEXT,
  ADD COLUMN "resolvedAdGroupId" TEXT,
  ADD COLUMN "gclidResolvedAt" TIMESTAMP(3),
  ADD COLUMN "gclidResolutionStatus" TEXT;

-- CreateIndex
CREATE INDEX "visitor_sessions_siteId_clickIdType_gclidResolvedAt_idx"
  ON "visitor_sessions"("siteId", "clickIdType", "gclidResolvedAt");
