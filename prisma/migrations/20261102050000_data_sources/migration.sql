-- CreateTable
CREATE TABLE "SourceSync" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "lastAttempt" TIMESTAMP(3),
    "lastSuccess" TIMESTAMP(3),
    "lastObserved" TIMESTAMP(3),
    "nextAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "etag" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SourceSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" TEXT NOT NULL,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCopper" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "quality" TEXT NOT NULL,

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceSnapshot_provider_market_publishedAt_idx" ON "SourceSnapshot"("provider", "market", "publishedAt");

-- CreateIndex
CREATE INDEX "PricePoint_provider_market_phase_observedAt_idx" ON "PricePoint"("provider", "market", "phase", "observedAt");

-- CreateIndex
CREATE INDEX "PricePoint_provider_market_itemKey_observedAt_idx" ON "PricePoint"("provider", "market", "itemKey", "observedAt");
