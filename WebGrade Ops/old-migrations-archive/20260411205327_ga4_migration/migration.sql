-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "ga4Connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ga4ConnectedAt" TIMESTAMP(3),
ADD COLUMN     "ga4ConnectedByUserId" TEXT,
ADD COLUMN     "ga4LastSyncAt" TIMESTAMP(3),
ADD COLUMN     "ga4PropertyId" TEXT,
ADD COLUMN     "gadsConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gadsConnectedAt" TIMESTAMP(3),
ADD COLUMN     "gadsConnectedByUserId" TEXT,
ADD COLUMN     "gadsCustomerId" TEXT,
ADD COLUMN     "gadsLastSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "gads_campaign_metrics" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "campaignType" TEXT,
    "status" TEXT,
    "costMicros" BIGINT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    "costPerConversion" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gads_campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gads_campaign_metrics_siteId_date_idx" ON "gads_campaign_metrics"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gads_campaign_metrics_siteId_campaignId_date_key" ON "gads_campaign_metrics"("siteId", "campaignId", "date");

-- AddForeignKey
ALTER TABLE "gads_campaign_metrics" ADD CONSTRAINT "gads_campaign_metrics_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
