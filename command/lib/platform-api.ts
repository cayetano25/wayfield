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

// ─── Token aliases (spec-required exports) ────────────────────────────────────
export const getPlatformToken = getToken;
export const setPlatformToken = setToken;
export const clearPlatformToken = clearToken;

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
  admin_name: string | null;
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

export type OrgStatus = 'active' | 'suspended' | 'inactive';
export type PlanCode = 'free' | 'starter' | 'pro' | 'enterprise';

export interface OrgSubscription {
  plan_code: PlanCode;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

// Shape returned by the list endpoint (full Eloquent model)
export interface OrgListItem {
  id: number;
  name: string;
  slug: string;
  status: OrgStatus;
  primary_contact_email: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  workshops_count: number;
  active_workshops_count: number;
  subscription: (OrgSubscription & { id: number; organization_id: number }) | null;
  organization_users: Array<{ id: number; user_id: number; role: string; is_active: boolean }>;
}

// Shape returned by the detail endpoint (custom response)
export interface OrgDetail {
  id: number;
  name: string;
  slug: string;
  status: OrgStatus;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  subscription: OrgSubscription | null;
  usage: {
    workshop_count: number;
    workshop_limit: number | null;
    participant_count: number;
    participant_limit: number | null;
    manager_count: number;
    manager_limit: number | null;
  };
}

export interface FeatureFlag {
  feature_key: string;
  description: string | null;
  is_enabled: boolean;
  source: 'plan_default' | 'manual_override';
}

export interface PlatformAuditLog {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  admin_user_id: number | null;
  admin_name: string | null;
  organization_id: number | null;
  organization_name: string | null;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
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

export const platformOrganizations = {
  list: (params?: { search?: string; plan?: string; status?: string; page?: number }) =>
    api.get<Paginated<OrgListItem>>('/organizations', { params }),
  get: (id: number) => api.get<OrgDetail>(`/organizations/${id}`),
  updateStatus: (id: number, status: OrgStatus, reason: string) =>
    api.patch(`/organizations/${id}/status`, { status, reason }),
  changePlan: (id: number, plan_code: PlanCode, reason: string) =>
    api.post(`/organizations/${id}/billing/plan`, { plan_code, reason }),
  getFeatureFlags: (id: number) =>
    api.get<FeatureFlag[]>(`/organizations/${id}/feature-flags`),
  setFeatureFlag: (id: number, feature_key: string, is_enabled: boolean) =>
    api.post(`/organizations/${id}/feature-flags`, { feature_key, is_enabled }),
};

export const platformAuditLogs = {
  list: (params?: {
    admin_user_id?: number;
    organization_id?: number;
    action?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
  }) => api.get<Paginated<PlatformAuditLog>>('/audit-logs', { params }),
};
