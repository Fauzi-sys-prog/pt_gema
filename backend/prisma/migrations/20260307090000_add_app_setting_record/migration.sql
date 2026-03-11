-- CreateTable
CREATE TABLE "AppSettingRecord" (
    "id" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppSettingRecord_updatedByUserId_idx" ON "AppSettingRecord"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "AppSettingRecord"
ADD CONSTRAINT "AppSettingRecord_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
