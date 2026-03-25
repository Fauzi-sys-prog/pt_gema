import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api"; // axios instance kamu (yang auto attach token)

import type { User } from "./AppContext"; // atau pindahin type User ke types biar clean

const AUTH_STATE_CHANGE_EVENT = "app-auth-state-changed";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeUser = (raw: any): User => {
  const displayName = raw?.fullName || raw?.name || raw?.username || "User";

  return {
    ...raw,
    fullName: displayName,
    role: raw?.role ?? "ADMIN",
    isActive: raw?.isActive ?? true,
  } as User;
};

const safeGetStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage access failures
  }
};

const safeRemoveStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage access failures
  }
};

const safeRemoveSessionStorageItem = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage access failures
  }
};

const persistUser = (user: User | null) => {
  if (!user) {
    safeRemoveStorageItem("user");
    return;
  }
  safeSetStorageItem("user", JSON.stringify(user));
};

const notifyAuthStateChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT));
};

const readPersistedUser = (): User | null => {
  try {
    const raw = safeGetStorageItem("user");
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    safeRemoveStorageItem("user");
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => readPersistedUser());
  const [loading, setLoading] = useState<boolean>(true);
  const authRequestVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearAuthState = () => {
    authRequestVersionRef.current += 1;
    safeRemoveStorageItem("token");
    persistUser(null);
    safeRemoveSessionStorageItem("auth401_notified");
    notifyAuthStateChanged();
    if (isMountedRef.current) {
      setCurrentUser(null);
    }
  };

  // Auto-check token -> fetch /auth/me
  useEffect(() => {
    const persistedUser = readPersistedUser();
    if (persistedUser && isMountedRef.current) {
      setCurrentUser(persistedUser);
    }

    const requestVersion = ++authRequestVersionRef.current;

    api
      .get("/auth/me")
      .then((res) => {
        if (authRequestVersionRef.current !== requestVersion || !isMountedRef.current) return;
        const normalizedUser = normalizeUser(res.data);
        setCurrentUser(normalizedUser);
        persistUser(normalizedUser);
        notifyAuthStateChanged();
      })
      .catch(() => {
        if (authRequestVersionRef.current !== requestVersion || !isMountedRef.current) return;
        clearAuthState();
      })
      .finally(() => {
        if (authRequestVersionRef.current === requestVersion && isMountedRef.current) {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "user") return;

      const persistedUser = readPersistedUser();
      if (!persistedUser) {
        clearAuthState();
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      if (isMountedRef.current) {
        setCurrentUser(persistedUser);
      }

      const requestVersion = ++authRequestVersionRef.current;
      if (isMountedRef.current) {
        setLoading(true);
      }
      api
        .get("/auth/me")
        .then((res) => {
          if (authRequestVersionRef.current !== requestVersion || !isMountedRef.current) return;
          const normalizedUser = normalizeUser(res.data);
          setCurrentUser(normalizedUser);
          persistUser(normalizedUser);
          notifyAuthStateChanged();
        })
        .catch(() => {
          if (authRequestVersionRef.current !== requestVersion || !isMountedRef.current) return;
          clearAuthState();
        })
        .finally(() => {
          if (authRequestVersionRef.current === requestVersion && isMountedRef.current) {
            setLoading(false);
          }
        });
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      safeRemoveSessionStorageItem("auth401_notified");
      authRequestVersionRef.current += 1;
      const res = await api.post("/auth/login", { username, password });
      safeRemoveStorageItem("token");

      // hydrate user penuh dari /auth/me agar shape user konsisten
      const meRes = await api.get("/auth/me");
      const normalizedUser = normalizeUser(meRes.data);
      if (isMountedRef.current) {
        setCurrentUser(normalizedUser);
      }
      persistUser(normalizedUser);
      notifyAuthStateChanged();
      if (isMountedRef.current) {
        setLoading(false);
      }

      return true;
    } catch (err: any) {
      // optional: biar rapi kalau login gagal
      clearAuthState();
      if (isMountedRef.current) {
        setLoading(false);
      }
      return false;
    }
  };

  const logout = () => {
    // Best-effort server logout: revoke current JWT jti in backend
    void api.post("/auth/logout").catch(() => undefined);
    clearAuthState();
    if (isMountedRef.current) {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
