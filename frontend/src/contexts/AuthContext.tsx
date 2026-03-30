import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "../types/auth";
import api from "../services/api";
import {
  AUTH_STATE_CHANGE_EVENT,
  normalizeAuthUser,
  notifyAuthStateChanged,
  persistAuthUser,
  readPersistedAuthUser,
} from "../utils/authState";

const CSRF_STORAGE_KEY = "ptgema_csrf_token";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => readPersistedAuthUser());
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
    safeRemoveSessionStorageItem(CSRF_STORAGE_KEY);
    persistAuthUser(null);
    safeRemoveSessionStorageItem("auth401_notified");
    notifyAuthStateChanged();
    if (isMountedRef.current) {
      setCurrentUser(null);
    }
  };

  // Auto-check token -> fetch /auth/me
  useEffect(() => {
    const persistedUser = readPersistedAuthUser();
    if (persistedUser && isMountedRef.current) {
      setCurrentUser(persistedUser);
    }

    const onLoginPage =
      typeof window !== "undefined" && window.location.pathname === "/login";
    if (!persistedUser && onLoginPage) {
      if (isMountedRef.current) {
        setLoading(false);
      }
      return;
    }

    const requestVersion = ++authRequestVersionRef.current;

    api
      .get("/auth/me")
      .then((res) => {
        if (authRequestVersionRef.current !== requestVersion || !isMountedRef.current) return;
        const normalizedUser = normalizeAuthUser(res.data);
        setCurrentUser(normalizedUser);
        persistAuthUser(normalizedUser);
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

      const persistedUser = readPersistedAuthUser();
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
          const normalizedUser = normalizeAuthUser(res.data);
          setCurrentUser(normalizedUser);
          persistAuthUser(normalizedUser);
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
      safeRemoveSessionStorageItem(CSRF_STORAGE_KEY);

      // hydrate user penuh dari /auth/me agar shape user konsisten
      const meRes = await api.get("/auth/me");
      const normalizedUser = normalizeAuthUser(meRes.data);
      if (isMountedRef.current) {
        setCurrentUser(normalizedUser);
      }
      persistAuthUser(normalizedUser);
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
