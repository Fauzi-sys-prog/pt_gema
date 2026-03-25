import axios from "axios";
import { emitDataSync } from "./dataSyncBus";
import { toast } from "sonner@2.0.3";

const rawApiBaseUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;

const resolveFallbackApiBaseUrl = (): string => {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const host = String(window.location.hostname || "").toLowerCase();
  if (host === "gemateknik.online" || host.endsWith(".gemateknik.online")) {
    return "https://api.gemateknik.online";
  }

  return "http://localhost:3000";
};

const API_BASE_URL = rawApiBaseUrl && String(rawApiBaseUrl).trim().length > 0
  ? String(rawApiBaseUrl).trim()
  : resolveFallbackApiBaseUrl();

const safeGetStorageItem = (storage: Storage | undefined, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeSetStorageItem = (storage: Storage | undefined, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore storage access failures in auth interceptor.
  }
};

const safeRemoveStorageItem = (storage: Storage | undefined, key: string) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage access failures in auth interceptor.
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => {
    const method = String(response?.config?.method || "get").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const path = String(response?.config?.url || "");
      const isAuthPath = path.startsWith("/auth/");
      const isDirectQuotationMutation =
        path === "/quotations" || path.startsWith("/quotations/");
      const isDirectDataCollectionMutation =
        path === "/data-collections" || path.startsWith("/data-collections/");
      const isAuditLogMutation =
        path === "/audit-logs" || path.startsWith("/audit-logs/");
      if (!isAuthPath && !isDirectQuotationMutation && !isDirectDataCollectionMutation && !isAuditLogMutation) {
        emitDataSync(`api:${method}:${path}`);
      }
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      const reqUrl = String(error?.config?.url || "");
      const isLoginRequest = reqUrl.startsWith("/auth/login");
      const isAuthProbeRequest = reqUrl.startsWith("/auth/me");
      const hadAuthHeader = Boolean(error?.config?.headers?.Authorization);
      const local = typeof localStorage !== "undefined" ? localStorage : undefined;
      const session = typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
      const hasStoredToken = Boolean(safeGetStorageItem(local, "token"));
      const hasStoredUser = Boolean(safeGetStorageItem(local, "user"));
      const hasStoredSession = hasStoredToken || hasStoredUser;
      // Prevent auth-loop on startup race: only force logout when request
      // actually carried auth header and still got 401.
      const shouldForceRelogin =
        !isLoginRequest && (hadAuthHeader || hasStoredSession || isAuthProbeRequest);
      if (shouldForceRelogin) {
        safeRemoveStorageItem(local, "token");
        safeRemoveStorageItem(local, "user");
      }
      const onLoginPage = window.location.pathname === "/login";
      const alreadyNotified = safeGetStorageItem(session, "auth401_notified") === "1";
      if (shouldForceRelogin && !alreadyNotified) {
        safeSetStorageItem(session, "auth401_notified", "1");
        toast.error("Sesi login habis. Silakan login ulang.");
      }
      if (shouldForceRelogin && !onLoginPage && !isLoginRequest) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
