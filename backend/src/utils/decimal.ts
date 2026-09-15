type DecimalLike = { toNumber: () => number };

// Prisma mengembalikan tipe Decimal (objek) untuk kolom numeric, bukan number.
// Duck-typing agar util ini tidak bergantung pada import Prisma.
export function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  );
}

// number | string | Prisma.Decimal -> number, atau null bila tidak valid.
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (isDecimalLike(value)) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toNumber(value: unknown, fallback = 0): number {
  return coerceNumber(value) ?? fallback;
}

// Mengubah Prisma.Decimal (rekursif) menjadi number untuk respons JSON,
// supaya API tetap mengirim number, bukan string.
export function serializeDecimals<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (isDecimalLike(value)) {
    return value.toNumber() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeDecimals(item);
    }
    return out as unknown as T;
  }
  return value;
}
