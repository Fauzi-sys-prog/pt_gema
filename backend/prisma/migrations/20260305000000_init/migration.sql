-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'PRODUKSI', 'SALES', 'FINANCE', 'SUPPLY_CHAIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppEntity" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "noPenawaran" TEXT,
    "tanggal" TEXT,
    "status" TEXT,
    "kepada" TEXT,
    "perihal" TEXT,
    "grandTotal" DOUBLE PRECISION,
    "dataCollectionId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollection" (
    "id" TEXT NOT NULL,
    "namaResponden" TEXT,
    "lokasi" TEXT,
    "tipePekerjaan" TEXT,
    "status" TEXT,
    "tanggalSurvey" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectApprovalLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationApprovalLog" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AppEntity_resource_idx" ON "AppEntity"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "AppEntity_resource_entityId_key" ON "AppEntity"("resource", "entityId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_dataCollectionId_idx" ON "Quotation"("dataCollectionId");

-- CreateIndex
CREATE INDEX "Quotation_updatedAt_idx" ON "Quotation"("updatedAt");

-- CreateIndex
CREATE INDEX "DataCollection_status_idx" ON "DataCollection"("status");

-- CreateIndex
CREATE INDEX "DataCollection_updatedAt_idx" ON "DataCollection"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_jti_key" ON "RevokedToken"("jti");

-- CreateIndex
CREATE INDEX "RevokedToken_userId_idx" ON "RevokedToken"("userId");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectApprovalLog_projectId_createdAt_idx" ON "ProjectApprovalLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectApprovalLog_action_idx" ON "ProjectApprovalLog"("action");

-- CreateIndex
CREATE INDEX "QuotationApprovalLog_quotationId_createdAt_idx" ON "QuotationApprovalLog"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotationApprovalLog_action_idx" ON "QuotationApprovalLog"("action");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_dataCollectionId_fkey" FOREIGN KEY ("dataCollectionId") REFERENCES "DataCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

