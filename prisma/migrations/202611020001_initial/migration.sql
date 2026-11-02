-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" TEXT NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unitCopper" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scan_fingerprint_key" ON "Scan"("fingerprint");

-- CreateIndex
CREATE INDEX "Scan_region_realm_faction_phase_observedAt_idx" ON "Scan"("region", "realm", "faction", "phase", "observedAt");

-- CreateIndex
CREATE INDEX "Observation_itemId_scanId_idx" ON "Observation"("itemId", "scanId");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
