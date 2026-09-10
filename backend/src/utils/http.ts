import { Response } from "express";

type ErrorBody = {
  code: string;
  message: string;
  details?: unknown;
  legacyError?: unknown;
};

export function sendError(res: Response, status: number, body: ErrorBody) {
  const payload: Record<string, unknown> = {
    code: body.code,
    message: body.message,
    error: body.legacyError ?? body.message,
  };

  if (body.details !== undefined) {
    payload.details = body.details;
  }

  return res.status(status).json(payload);
}
