import { NextFunction, Response } from "express";
import { AuthRequest } from "../types/auth";
import { env } from "../config/env";
import { readAccessTokenCookie } from "../utils/authCookie";
import { readCsrfTokenCookie } from "../utils/csrf";
import { sendError } from "../utils/http";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SAFE_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

function getHeaderValue(header: string | string[] | undefined): string | null {
  if (typeof header === "string") {
    const trimmed = header.trim();
    return trimmed || null;
  }
  if (Array.isArray(header)) {
    for (const value of header) {
      const trimmed = String(value || "").trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function resolveRequestOrigin(req: AuthRequest): string | null {
  const originHeader = getHeaderValue(req.headers.origin);
  if (originHeader) return originHeader;

  const refererHeader = getHeaderValue(req.headers.referer);
  if (!refererHeader) return null;

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

function hasBearerAuthorization(req: AuthRequest) {
  const authHeader = getHeaderValue(req.headers.authorization);
  return Boolean(authHeader && authHeader.startsWith("Bearer "));
}

export function protectAgainstCsrf(req: AuthRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return next();
  }

  const secFetchSite = getHeaderValue(req.headers["sec-fetch-site"]);
  if (secFetchSite && !SAFE_FETCH_SITES.has(secFetchSite.toLowerCase())) {
    return sendError(res, 403, {
      code: "CSRF_CROSS_SITE_BLOCKED",
      message: "Cross-site write request blocked",
      legacyError: "Cross-site write request blocked",
    });
  }

  const origin = resolveRequestOrigin(req);
  if (origin && !env.corsOrigins.includes(origin)) {
    return sendError(res, 403, {
      code: "CSRF_ORIGIN_DENIED",
      message: "Origin denied for write request",
      legacyError: "Origin denied for write request",
      details: { origin },
    });
  }

  if (hasBearerAuthorization(req)) {
    return next();
  }

  const accessTokenCookie = readAccessTokenCookie(req);
  if (!accessTokenCookie) {
    return next();
  }

  const csrfCookieToken = readCsrfTokenCookie(req);
  const csrfHeaderToken = getHeaderValue(req.headers["x-csrf-token"]);

  if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
    return sendError(res, 403, {
      code: "CSRF_TOKEN_INVALID",
      message: "CSRF validation failed",
      legacyError: "CSRF validation failed",
    });
  }

  return next();
}
