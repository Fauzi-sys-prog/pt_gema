-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "details" TEXT,
    "status" TEXT,
    "domain" TEXT,
    "resource" TEXT,
    "entityId" TEXT,
    "operation" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- Backfill from AppEntity(resource='audit-logs')
INSERT INTO "AuditLogEntry" (
    "id", "timestamp", "actorUserId", "actorRole", "userId", "userName", "action", "module",
    "details", "status", "domain", "resource", "entityId", "operation", "metadata", "createdAt", "updatedAt"
)
SELECT
    ae."entityId",
    COALESCE(NULLIF(ae."payload"->>'timestamp', '')::timestamptz, ae."createdAt")::timestamp(3),
    NULLIF(ae."payload"->>'actorUserId', ''),
    NULLIF(ae."payload"->>'actorRole', ''),
    NULLIF(ae."payload"->>'userId', ''),
    NULLIF(ae."payload"->>'userName', ''),
    COALESCE(NULLIF(ae."payload"->>'action', ''), 'SYSTEM_EVENT'),
    NULLIF(ae."payload"->>'module', ''),
    NULLIF(ae."payload"->>'details', ''),
    COALESCE(NULLIF(ae."payload"->>'status', ''), 'Success'),
    NULLIF(ae."payload"->>'domain', ''),
    NULLIF(ae."payload"->>'resource', ''),
    NULLIF(ae."payload"->>'entityId', ''),
    NULLIF(ae."payload"->>'operation', ''),
    CASE
      WHEN ae."payload" ? 'metadata' THEN (ae."payload"->'metadata')::text
      ELSE NULL
    END,
    ae."createdAt",
    ae."updatedAt"
FROM "AppEntity" ae
WHERE ae."resource" = 'audit-logs'
ON CONFLICT ("id") DO NOTHING;

-- Backfill from legacy dedicated payload table
INSERT INTO "AuditLogEntry" (
    "id", "timestamp", "actorUserId", "actorRole", "userId", "userName", "action", "module",
    "details", "status", "domain", "resource", "entityId", "operation", "metadata", "createdAt", "updatedAt"
)
SELECT
    alr."id",
    COALESCE(NULLIF(alr."payload"->>'timestamp', '')::timestamptz, alr."createdAt")::timestamp(3),
    NULLIF(alr."payload"->>'actorUserId', ''),
    NULLIF(alr."payload"->>'actorRole', ''),
    NULLIF(alr."payload"->>'userId', ''),
    NULLIF(alr."payload"->>'userName', ''),
    COALESCE(NULLIF(alr."payload"->>'action', ''), 'SYSTEM_EVENT'),
    NULLIF(alr."payload"->>'module', ''),
    NULLIF(alr."payload"->>'details', ''),
    COALESCE(NULLIF(alr."payload"->>'status', ''), 'Success'),
    NULLIF(alr."payload"->>'domain', ''),
    NULLIF(alr."payload"->>'resource', ''),
    NULLIF(alr."payload"->>'entityId', ''),
    NULLIF(alr."payload"->>'operation', ''),
    CASE
      WHEN alr."payload" ? 'metadata' THEN (alr."payload"->'metadata')::text
      ELSE NULL
    END,
    alr."createdAt",
    alr."updatedAt"
FROM "AuditLogRecord" alr
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "AuditLogEntry_timestamp_idx" ON "AuditLogEntry"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLogEntry_actorUserId_idx" ON "AuditLogEntry"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_domain_idx" ON "AuditLogEntry"("domain");

-- CreateIndex
CREATE INDEX "AuditLogEntry_resource_idx" ON "AuditLogEntry"("resource");

-- CreateIndex
CREATE INDEX "AuditLogEntry_operation_idx" ON "AuditLogEntry"("operation");

-- CreateIndex
CREATE INDEX "AuditLogEntry_status_idx" ON "AuditLogEntry"("status");

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove legacy rows/tables
DELETE FROM "AppEntity" WHERE "resource" = 'audit-logs';
DROP TABLE "AuditLogRecord";
