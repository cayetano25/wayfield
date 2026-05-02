'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { AdminUser, clearToken, platformAuth } from '@/lib/platform-api';

interface AdminUserContextValue {
  adminUser: AdminUser | null;
  setAdminUser: (user: AdminUser | null) => void;
  logout: () => Promise<void>;
}

const AdminUserContext = createContext<AdminUserContextValue | null>(null);

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const logout = useCallback(async () => {
    try {
      await platformAuth.logout();
    } catch {
      // proceed regardless
    }
    clearToken();
    setAdminUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AdminUserContext.Provider value={{ adminUser, setAdminUser, logout }}>
      {children}
    </AdminUserContext.Provider>
  );
}

export function useAdminUser(): AdminUserContextValue {
  const ctx = useContext(AdminUserContext);
  if (!ctx) throw new Error('useAdminUser must be used within AdminUserProvider');
  return ctx;
}
