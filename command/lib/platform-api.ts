import axios, { AxiosInstance, AxiosError } from 'axios';

export const TOKEN_KEY = 'cc_platform_token';

const BASE_URL =
  (process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? 'http://localhost:8000/api') +
  '/platform/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'billing' | 'readonly';

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  can_impersonate: boolean;
  last_login_at: string | null;
}

export interface AuditEvent {
  id: number;
  action: string;
  admin_user_email: string | null;
  organization_name: string | null;
  created_at: string;
}

export interface OverviewResponse {
  organizations: {
    total: number;
    by_status: Record<string, number>;
    by_plan: { free: number; starter: number; pro: number; enterprise: number };
  };
  users: { total: number; active_30_days: number; new_7_days: number };
  workshops: { total: number; by_status: Record<string, number> };
  stripe_note: string;
  recent_audit_events: AuditEvent[];
  generated_at: string;
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const platformAuth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; admin_user: AdminUser }>('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<AdminUser>('/auth/me'),
};

export const platformOverview = {
  get: () => api.get<OverviewResponse>('/overview'),
};
