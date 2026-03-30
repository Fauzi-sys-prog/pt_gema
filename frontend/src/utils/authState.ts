import type { User } from "../types/auth";

export const AUTH_STATE_CHANGE_EVENT = "app-auth-state-changed";

const USER_STORAGE_KEY = "user";

const safeGetLocalStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetLocalStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage access failures in auth state helpers.
  }
};

const safeRemoveLocalStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures in auth state helpers.
  }
};

export const normalizeAuthUser = (raw: any): User => {
  const displayName = raw?.fullName || raw?.name || raw?.username || "User";

  return {
    ...raw,
    fullName: displayName,
    role: raw?.role ?? "ADMIN",
    isActive: raw?.isActive ?? true,
  } as User;
};

export const persistAuthUser = (user: User | null) => {
  if (!user) {
    safeRemoveLocalStorageItem(USER_STORAGE_KEY);
    return;
  }

  safeSetLocalStorageItem(USER_STORAGE_KEY, JSON.stringify(user));
};

export const readPersistedAuthUser = (): User | null => {
  try {
    const raw = safeGetLocalStorageItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return normalizeAuthUser(JSON.parse(raw));
  } catch {
    safeRemoveLocalStorageItem(USER_STORAGE_KEY);
    return null;
  }
};

export const notifyAuthStateChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT));
};
