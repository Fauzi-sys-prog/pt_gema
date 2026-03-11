import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api"; // axios instance kamu (yang auto attach token)

import type { User } from "./AppContext"; // atau pindahin type User ke types biar clean

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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auto-check token -> fetch /auth/me
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        setCurrentUser(normalizeUser(res.data));
      })
      .catch(() => {
        localStorage.removeItem("token");
        setCurrentUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await api.post("/auth/login", { username, password });

      // simpan JWT
      localStorage.setItem("token", res.data.token);

      // set user dari response backend
      setCurrentUser(normalizeUser(res.data.user));

      return true;
    } catch (err: any) {
      // optional: biar rapi kalau login gagal
      localStorage.removeItem("token");
      setCurrentUser(null);
      return false;
    }
  };

  const logout = () => {
    // Best-effort server logout: revoke current JWT jti in backend
    void api.post("/auth/logout").catch(() => undefined);
    localStorage.removeItem("token");
    setCurrentUser(null);
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
