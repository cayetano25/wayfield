'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AdminUser, AdminRole, clearToken, getToken, platformAuth } from '@/lib/platform-api';

interface AdminUserContextValue {
  adminUser: AdminUser | null;
  isLoading: boolean;
  setAdminUser: (user: AdminUser | null) => void;
  logout: () => Promise<void>;
}

const AdminUserContext = createContext<AdminUserContextValue | null>(null);

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    platformAuth
      .me()
      .then(({ data }) => {
        setAdminUser(data);
      })
      .catch(() => {
        // 401 interceptor already cleared the token; nothing else to do
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

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
    <AdminUserContext.Provider value={{ adminUser, isLoading, setAdminUser, logout }}>
      {children}
    </AdminUserContext.Provider>
  );
}

export function useAdminUser(): AdminUserContextValue {
  const ctx = useContext(AdminUserContext);
  if (!ctx) throw new Error('useAdminUser must be used within AdminUserProvider');
  return ctx;
}

// ─── Role capability helpers ──────────────────────────────────────────────────
export const can = {
  manageBilling:      (role: AdminRole) => (['super_admin', 'billing'] as AdminRole[]).includes(role),
  manageFeatureFlags: (role: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(role),
  viewUsers:          (role: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(role),
  viewFinancials:     (role: AdminRole) => (['super_admin', 'billing'] as AdminRole[]).includes(role),
  viewSupport:        (role: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(role),
  manageAutomations:  (role: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(role),
  viewSecurity:       (role: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(role),
  viewAuditLog:       (role: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(role),
  manageSettings:     (role: AdminRole) => role === 'super_admin',
};
