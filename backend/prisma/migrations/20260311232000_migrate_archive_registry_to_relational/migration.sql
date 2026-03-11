-- CreateTable
CREATE TABLE "ArchiveRegistryEntry" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "projectName" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveRegistryEntry_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ArchiveRegistryEntry" (
    "id", "tanggal", "reference", "description", "amount", "projectName", "adminName", "type", "source", "createdAt", "updatedAt"
)
SELECT
    ae."entityId",
    COALESCE(NULLIF(ae."payload"->>'date', '')::timestamptz, ae."createdAt")::timestamp(3),
    COALESCE(NULLIF(ae."payload"->>'ref', ''), ae."entityId"),
    COALESCE(NULLIF(ae."payload"->>'description', ''), ae."entityId"),
    COALESCE(NULLIF(ae."payload"->>'amount', '')::double precision, 0),
    COALESCE(NULLIF(ae."payload"->>'project', ''), '-'),
    COALESCE(NULLIF(ae."payload"->>'admin', ''), 'System'),
    COALESCE(NULLIF(ae."payload"->>'type', ''), 'BK'),
    COALESCE(NULLIF(ae."payload"->>'source', ''), 'legacy'),
    ae."createdAt",
    ae."updatedAt"
FROM "AppEntity" ae
WHERE ae."resource" = 'archive-registry'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ArchiveRegistryEntry" (
    "id", "tanggal", "reference", "description", "amount", "projectName", "adminName", "type", "source", "createdAt", "updatedAt"
)
SELECT
    arr."id",
    COALESCE(NULLIF(arr."payload"->>'date', '')::timestamptz, arr."createdAt")::timestamp(3),
    COALESCE(NULLIF(arr."payload"->>'ref', ''), arr."id"),
    COALESCE(NULLIF(arr."payload"->>'description', ''), arr."id"),
    COALESCE(NULLIF(arr."payload"->>'amount', '')::double precision, 0),
    COALESCE(NULLIF(arr."payload"->>'project', ''), '-'),
    COALESCE(NULLIF(arr."payload"->>'admin', ''), 'System'),
    COALESCE(NULLIF(arr."payload"->>'type', ''), 'BK'),
    COALESCE(NULLIF(arr."payload"->>'source', ''), 'legacy'),
    arr."createdAt",
    arr."updatedAt"
FROM "ArchiveRegistryRecord" arr
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "ArchiveRegistryEntry_tanggal_idx" ON "ArchiveRegistryEntry"("tanggal");
CREATE INDEX "ArchiveRegistryEntry_type_idx" ON "ArchiveRegistryEntry"("type");
CREATE INDEX "ArchiveRegistryEntry_source_idx" ON "ArchiveRegistryEntry"("source");

DELETE FROM "AppEntity" WHERE "resource" = 'archive-registry';
DROP TABLE "ArchiveRegistryRecord";
