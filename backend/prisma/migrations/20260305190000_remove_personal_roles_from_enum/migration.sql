BEGIN;

-- Recreate Role enum without personal-name values and remap legacy data safely.
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM (
  'OWNER',
  'ADMIN',
  'MANAGER',
  'HR',
  'PURCHASING',
  'USER',
  'PRODUKSI',
  'SALES',
  'FINANCE',
  'SUPPLY_CHAIN',
  'WAREHOUSE',
  'OPERATIONS'
);

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'AJI' THEN 'OWNER'
      WHEN 'ANGESTI' THEN 'SALES'
      WHEN 'ENING' THEN 'FINANCE'
      WHEN 'DEWI' THEN 'SUPPLY_CHAIN'
      ELSE "role"::text
    END
  )::"Role";

ALTER TABLE "ProjectApprovalLog"
  ALTER COLUMN "actorRole" TYPE "Role"
  USING (
    CASE
      WHEN "actorRole" IS NULL THEN NULL
      WHEN "actorRole"::text = 'AJI' THEN 'OWNER'
      WHEN "actorRole"::text = 'ANGESTI' THEN 'SALES'
      WHEN "actorRole"::text = 'ENING' THEN 'FINANCE'
      WHEN "actorRole"::text = 'DEWI' THEN 'SUPPLY_CHAIN'
      ELSE "actorRole"::text
    END
  )::"Role";

ALTER TABLE "QuotationApprovalLog"
  ALTER COLUMN "actorRole" TYPE "Role"
  USING (
    CASE
      WHEN "actorRole" IS NULL THEN NULL
      WHEN "actorRole"::text = 'AJI' THEN 'OWNER'
      WHEN "actorRole"::text = 'ANGESTI' THEN 'SALES'
      WHEN "actorRole"::text = 'ENING' THEN 'FINANCE'
      WHEN "actorRole"::text = 'DEWI' THEN 'SUPPLY_CHAIN'
      ELSE "actorRole"::text
    END
  )::"Role";

DROP TYPE "Role_old";

COMMIT;
