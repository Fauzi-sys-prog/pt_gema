export function normalizeEntityRows<T>(payload: unknown): T[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return rows
    .map((row: any) => {
      if (!row || typeof row !== "object") return null;
      const record =
        row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? row.payload
          : row;
      if (record && typeof record === "object" && !Array.isArray(record) && !record.id && row?.entityId) {
        return { ...record, id: row.entityId } as T;
      }
      return record as T;
    })
    .filter(Boolean) as T[];
}
