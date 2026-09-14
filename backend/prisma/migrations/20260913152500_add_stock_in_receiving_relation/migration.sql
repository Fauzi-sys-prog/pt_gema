ALTER TABLE "InventoryStockIn"
ADD COLUMN "receivingId" TEXT;

-- Backfill hanya ketika satu Stock In cocok tepat ke satu Receiving.
WITH matched AS (
  SELECT
    si.id AS stock_in_id,
    MIN(r.id) AS receiving_id
  FROM "InventoryStockIn" si
  JOIN "ProcurementReceiving" r
    ON (
      si.id = 'SI-AUTO-' || r.id
      OR (
        si.type IN ('Receiving', 'Purchase Receiving')
        AND si."suratJalanNumber" IS NOT NULL
        AND si."suratJalanNumber" = r."suratJalanNo"
      )
    )
  GROUP BY si.id
  HAVING COUNT(*) = 1
)
UPDATE "InventoryStockIn" si
SET "receivingId" = matched.receiving_id
FROM matched
WHERE si.id = matched.stock_in_id;

CREATE UNIQUE INDEX "InventoryStockIn_receivingId_key"
ON "InventoryStockIn"("receivingId");

ALTER TABLE "InventoryStockIn"
ADD CONSTRAINT "InventoryStockIn_receivingId_fkey"
FOREIGN KEY ("receivingId")
REFERENCES "ProcurementReceiving"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
