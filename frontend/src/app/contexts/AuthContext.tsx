import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User } from './AppContext';
import { authService } from '../services/authService';
import { clearAllStoredState } from '../utils/useStoredState';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const mapBackendUser = (user: any): User => {
    const roleMap: Record<string, string> = {
      OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', SPV: 'SPV',
      FINANCE_ACCOUNTING: 'Finance & Accounting',
      SALES_MARKETING: 'Sales & Marketing',
      OPERATIONAL_PRODUCTION: 'Operasional & Produksi',
      HSE: 'HSE',
      FINANCE: 'Finance & Accounting', SALES: 'Sales & Marketing',
      PRODUKSI: 'Operasional & Produksi', OPERATIONS: 'Operasional & Produksi',
      SUPPLY_CHAIN: 'Operasional & Produksi', WAREHOUSE: 'Operasional & Produksi',
      PURCHASING: 'Operasional & Produksi', HR: 'HR', USER: 'Operasional & Produksi',
    };
    return {
      id: user.id,
      username: user.username,
      fullName: user.name || user.username,
      signatureUrl: user.signatureUrl || undefined,
      role: roleMap[user.role] || user.role,
      status: user.isActive === false ? 'Inactive' : 'Active',
      lastLogin: user.lastLogin || user.lastLoginAt,
    };
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const backendUser = await authService.getCurrentUser();
        const mapped = mapBackendUser(backendUser);
        setCurrentUser(mapped);
        localStorage.setItem('currentUser', JSON.stringify(mapped));
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('csrfToken');
        localStorage.removeItem('currentUser');
      } finally {
        setLoading(false);
      }
    };
    void restoreSession();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await authService.login(username, password);
      const user = mapBackendUser(result.user);
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    void authService.logout();
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    clearAllStoredState();
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
