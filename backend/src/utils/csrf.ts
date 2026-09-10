import crypto from "crypto";
import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";

export const CSRF_COOKIE_NAME = env.csrfCookieName;

function parseDurationMs(rawValue: string): number | undefined {
  const normalized = rawValue.trim();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const unit = (match[2] || "ms").toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 1);
}

const csrfCookieMaxAge = parseDurationMs(env.jwtExpiresIn);

const baseCookieOptions: CookieOptions = {
  httpOnly: false,
  sameSite: "lax",
  secure: env.cookieSecure,
  path: env.cookiePath,
};

const csrfCookieOptions: CookieOptions = csrfCookieMaxAge
  ? { ...baseCookieOptions, maxAge: csrfCookieMaxAge }
  : baseCookieOptions;

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return acc;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) return acc;

      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }

      return acc;
    }, {});
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function setCsrfTokenCookie(res: Response, token: string) {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
}

export function clearCsrfTokenCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE_NAME, baseCookieOptions);
}

export function readCsrfTokenCookie(req: Pick<Request, "headers">): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[CSRF_COOKIE_NAME];
  if (typeof token !== "string") return null;

  const trimmed = token.trim();
  return trimmed || null;
}

export function ensureCsrfTokenCookie(req: Pick<Request, "headers">, res: Response) {
  const existingToken = readCsrfTokenCookie(req);
  if (existingToken) return existingToken;

  const token = generateCsrfToken();
  setCsrfTokenCookie(res, token);
  return token;
}
