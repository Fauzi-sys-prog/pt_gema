import { asRecord, asTrimmedString, toFiniteNumber } from "./dataPayloadUtils";

type QuantityMaps = {
  receivedByCode: Map<string, number>;
  receivedByName: Map<string, number>;
};

function createQuantityMaps(): QuantityMaps {
  return {
    receivedByCode: new Map<string, number>(),
    receivedByName: new Map<string, number>(),
  };
}

function normalizeLookupKey(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function addReceivedQuantity(
  quantityMaps: QuantityMaps,
  codeKey: string,
  nameKey: string,
  qty: number,
) {
  if (qty <= 0) return;
  if (codeKey) {
    quantityMaps.receivedByCode.set(
      codeKey,
      (quantityMaps.receivedByCode.get(codeKey) || 0) + qty,
    );
  }
  if (nameKey) {
    quantityMaps.receivedByName.set(
      nameKey,
      (quantityMaps.receivedByName.get(nameKey) || 0) + qty,
    );
  }
}

export function isPostedReceivingStockIn(payload: Record<string, unknown>): boolean {
  const type = String(payload.type || "").trim().toLowerCase();
  const status = String(payload.status || "").trim().toLowerCase();
  return type === "receiving" && status === "posted";
}

export function isTerminalPurchaseOrderStatus(status?: string | null): boolean {
  return ["Received", "Rejected", "Cancelled"].includes(
    String(status || "").trim(),
  );
}

export function matchesPurchaseOrderReference({
  rowPoId,
  rowPayloadPoId,
  rowNoPO,
  poId,
  poNo,
}: {
  rowPoId?: string | null;
  rowPayloadPoId?: string | null;
  rowNoPO?: string | null;
  poId: string;
  poNo: string;
}): boolean {
  const normalizedRowPoId = String(rowPoId || "").trim();
  const normalizedPayloadPoId = String(rowPayloadPoId || "").trim();
  const normalizedRowNoPO = normalizeLookupKey(rowNoPO);
  return Boolean(
    (normalizedRowPoId && normalizedRowPoId === poId) ||
    (normalizedPayloadPoId && normalizedPayloadPoId === poId) ||
    (poNo && normalizedRowNoPO && normalizedRowNoPO === poNo),
  );
}

export function buildReceivedQuantitiesFromRelationalStockIns(
  rows: Array<{
    type?: string | null;
    status?: string | null;
    items: Array<{ qty: number; itemCode: string | null; itemName: string }>;
  }>,
): QuantityMaps {
  const quantityMaps = createQuantityMaps();
  for (const row of rows) {
    if (!isPostedReceivingStockIn(row as Record<string, unknown>)) continue;
    for (const item of row.items) {
      const qty = Math.max(0, item.qty);
      addReceivedQuantity(
        quantityMaps,
        normalizeLookupKey(item.itemCode),
        normalizeLookupKey(item.itemName),
        qty,
      );
    }
  }
  return quantityMaps;
}

export function buildReceivedQuantitiesFromRelationalReceivings(
  rows: Array<{
    status: string;
    items: Array<{
      qtyReceived: number;
      qtyGood: number;
      itemCode: string | null;
      itemName: string;
    }>;
  }>,
): QuantityMaps {
  const quantityMaps = createQuantityMaps();
  for (const row of rows) {
    if (row.status === "Rejected") continue;
    for (const item of row.items) {
      const qty = Math.max(0, item.qtyReceived || item.qtyGood || 0);
      addReceivedQuantity(
        quantityMaps,
        normalizeLookupKey(item.itemCode),
        normalizeLookupKey(item.itemName),
        qty,
      );
    }
  }
  return quantityMaps;
}

export function buildReceivedQuantitiesFromLegacyStockIns(
  rows: Array<{ poId: string | null; payload: unknown }>,
  poId: string,
  poNo: string,
): QuantityMaps {
  const quantityMaps = createQuantityMaps();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    if (!isPostedReceivingStockIn(payload)) continue;
    if (
      !matchesPurchaseOrderReference({
        rowPoId: row.poId,
        rowPayloadPoId: asTrimmedString(payload.poId),
        rowNoPO: asTrimmedString(payload.noPO),
        poId,
        poNo,
      })
    ) {
      continue;
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const itemRaw of items) {
      const item = asRecord(itemRaw);
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      addReceivedQuantity(
        quantityMaps,
        normalizeLookupKey(item.kode),
        normalizeLookupKey(item.nama),
        qty,
      );
    }
  }
  return quantityMaps;
}

export function buildReceivedQuantitiesFromLegacyReceivings(
  rows: Array<{ poId: string | null; payload: unknown }>,
  poId: string,
  poNo: string,
): QuantityMaps {
  const quantityMaps = createQuantityMaps();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    if (String(asTrimmedString(payload.status) || "").trim() === "Rejected") {
      continue;
    }
    if (
      !matchesPurchaseOrderReference({
        rowPoId: row.poId,
        rowPayloadPoId: asTrimmedString(payload.poId),
        rowNoPO: asTrimmedString(payload.noPO),
        poId,
        poNo,
      })
    ) {
      continue;
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const itemRaw of items) {
      const item = asRecord(itemRaw);
      const qty = Math.max(
        0,
        toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
      );
      addReceivedQuantity(
        quantityMaps,
        normalizeLookupKey(item.itemKode),
        normalizeLookupKey(item.itemName),
        qty,
      );
    }
  }
  return quantityMaps;
}

export function applyReceivedQuantitiesToRelationalPoItems<
  T extends {
    itemCode: string | null;
    itemName: string;
    qty: number;
  },
>(items: T[], quantityMaps: QuantityMaps): Array<T & { qtyReceived: number }> {
  return items.map((item) => {
    const codeKey = normalizeLookupKey(item.itemCode);
    const nameKey = normalizeLookupKey(item.itemName);
    const ordered = Math.max(0, item.qty);
    const qtyReceived = Math.min(
      ordered,
      Math.max(
        quantityMaps.receivedByCode.get(codeKey) || 0,
        quantityMaps.receivedByName.get(nameKey) || 0,
      ),
    );
    return { ...item, qtyReceived };
  });
}

export function applyReceivedQuantitiesToLegacyPoItems(
  itemsRaw: unknown[],
  quantityMaps: QuantityMaps,
): Array<Record<string, unknown> & { qty: number; qtyReceived: number }> {
  return itemsRaw.map((itemRaw) => {
    const item = asRecord(itemRaw);
    const codeKey = normalizeLookupKey(item.kode);
    const nameKey = normalizeLookupKey(item.nama);
    const ordered = Math.max(0, toFiniteNumber(item.qty, 0));
    const qtyReceived = Math.min(
      ordered,
      Math.max(
        quantityMaps.receivedByCode.get(codeKey) || 0,
        quantityMaps.receivedByName.get(nameKey) || 0,
      ),
    );
    return {
      ...item,
      qty: ordered,
      qtyReceived,
    };
  });
}

export function summarizePurchaseOrderProgress<T>(
  items: T[],
  getOrdered: (item: T) => number,
  getReceived: (item: T) => number,
) {
  const hasItems = items.length > 0;
  const allReceived =
    hasItems &&
    items.every((item) => Math.max(0, getReceived(item)) >= Math.max(0, getOrdered(item)));
  const someReceived = items.some((item) => Math.max(0, getReceived(item)) > 0);
  return {
    hasItems,
    allReceived,
    someReceived,
    nextStatus: allReceived ? "Received" : "Partial",
  };
}
