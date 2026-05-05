-- CreateTable
CREATE TABLE "conversion_goals" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversion_goals_siteId_idx" ON "conversion_goals"("siteId");

-- AddForeignKey
ALTER TABLE "conversion_goals" ADD CONSTRAINT "conversion_goals_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
