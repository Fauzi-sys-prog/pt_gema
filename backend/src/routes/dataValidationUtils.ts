export class PayloadValidationError extends Error {
  code = "PAYLOAD_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PayloadValidationError";
  }
}

export function assertNoUnknownKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new PayloadValidationError(
      `${context}: field tidak dikenal -> ${unknown.join(", ")}`,
    );
  }
}

export function assertStatusInList(
  status: string | null,
  allowed: readonly string[],
  context: string,
): string | null {
  if (!status) return null;
  if (!allowed.includes(status)) {
    throw new PayloadValidationError(`${context}: status '${status}' tidak valid`);
  }
  return status;
}
