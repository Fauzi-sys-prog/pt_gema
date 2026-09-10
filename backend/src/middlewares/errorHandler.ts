import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { sendError } from "../utils/http";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof z.ZodError) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten(),
      legacyError: err.flatten(),
    });
  }

  // Handle malformed JSON body from clients safely.
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, 400, {
      code: "INVALID_JSON",
      message: "Invalid JSON payload",
      legacyError: "Invalid JSON payload",
    });
  }

  // Body parser rejects oversized payloads with status=413 / type=entity.too.large.
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 413
  ) {
    return sendError(res, 413, {
      code: "PAYLOAD_TOO_LARGE",
      message: "Payload too large. Compress image/signature or upload smaller files.",
      legacyError: "Payload too large",
    });
  }

  // Keep CORS rejection explicit and non-500.
  if (err instanceof Error && err.message === "CORS origin denied") {
    return sendError(res, 403, {
      code: "CORS_DENIED",
      message: "CORS origin denied",
      legacyError: "CORS origin denied",
    });
  }

  return sendError(res, 500, {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    legacyError: "Internal server error",
  });
}
