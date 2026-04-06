'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { clearStoredUser, clearToken, setStoredUser, type AdminUser } from '@/lib/auth/session';

interface Organization {
  id: number;
  name: string;
  slug: string;
  role: string;
  plan_code: string;
}

interface UserContextValue {
  user: AdminUser | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const [me, orgs] = await Promise.all([
        apiGet<AdminUser>('/me'),
        apiGet<Organization[]>('/me/organizations'),
      ]);
      setUser(me);
      setOrganizations(orgs);
      setCurrentOrg((prev) => {
        if (prev) return orgs.find((o) => o.id === prev.id) ?? orgs[0] ?? null;
        return orgs[0] ?? null;
      });
      setStoredUser(me);
    } catch {
      // 401 is handled in client.ts
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const [me, orgs] = await Promise.all([
          apiGet<AdminUser>('/me'),
          apiGet<Organization[]>('/me/organizations'),
        ]);
        setUser(me);
        setOrganizations(orgs);
        setCurrentOrg(orgs[0] ?? null);
      } catch {
        // 401 is handled in client.ts (redirects to /login)
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // ignore errors on logout
    } finally {
      clearToken();
      clearStoredUser();
      router.push('/login');
    }
  }, [router]);

  return (
    <UserContext.Provider value={{ user, organizations, currentOrg, setCurrentOrg, refreshUser, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
