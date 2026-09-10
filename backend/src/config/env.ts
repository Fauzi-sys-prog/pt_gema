import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET;

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const normalizeCookieName = (value: string | undefined, fallback: string) => {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
};

const normalizeCookiePath = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

if (!jwtSecret) {
  throw new Error("JWT_SECRET must be defined");
}

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

const looksWeakSecret =
  /change[_-]?this|supersecret|password|12345|default|example/i.test(jwtSecret);
if (nodeEnv === "production" && looksWeakSecret) {
  throw new Error("JWT_SECRET is too weak for production");
}

const rawCorsOrigins = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOrigins = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowLocalhostCorsInProd =
  process.env.ALLOW_LOCALHOST_CORS_IN_PROD === "true";
const cookieSecureOverride = parseBoolean(process.env.COOKIE_SECURE);

if (nodeEnv === "production") {
  if (corsOrigins.length === 0) {
    throw new Error("CORS_ORIGIN must be defined in production");
  }
  if (
    !allowLocalhostCorsInProd &&
    corsOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))
  ) {
    throw new Error("CORS_ORIGIN must not use localhost in production");
  }
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  apiBodyLimit: process.env.API_BODY_LIMIT || "15mb",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  filePublicBaseUrl:
    process.env.FILE_PUBLIC_BASE_URL ||
    `http://localhost:${Number(process.env.PORT) || 3000}`,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  jwtIssuer: process.env.JWT_ISSUER || "ptgema-api",
  jwtAudience: process.env.JWT_AUDIENCE || "ptgema-client",
  corsOrigins,
  accessTokenCookieName: normalizeCookieName(
    process.env.ACCESS_TOKEN_COOKIE_NAME,
    "ptgema_access_token",
  ),
  csrfCookieName: normalizeCookieName(
    process.env.CSRF_COOKIE_NAME,
    "ptgema_csrf_token",
  ),
  cookiePath: normalizeCookiePath(process.env.COOKIE_PATH),
  cookieSecure:
    typeof cookieSecureOverride === "boolean"
      ? cookieSecureOverride
      : nodeEnv === "production",
};
