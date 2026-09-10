import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";

export const ACCESS_TOKEN_COOKIE_NAME = env.accessTokenCookieName;

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

const accessTokenCookieMaxAge = parseDurationMs(env.jwtExpiresIn);

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.cookieSecure,
  path: env.cookiePath,
};

const accessTokenCookieOptions: CookieOptions = accessTokenCookieMaxAge
  ? { ...baseCookieOptions, maxAge: accessTokenCookieMaxAge }
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

export function setAccessTokenCookie(res: Response, token: string) {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, accessTokenCookieOptions);
}

export function clearAccessTokenCookie(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, baseCookieOptions);
}

export function readAccessTokenCookie(req: Pick<Request, "headers">): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[ACCESS_TOKEN_COOKIE_NAME];
  if (typeof token !== "string") return null;

  const trimmed = token.trim();
  return trimmed || null;
}
