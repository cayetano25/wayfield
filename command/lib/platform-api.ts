import axios, { AxiosInstance, AxiosError } from 'axios';

export const TOKEN_KEY = 'cc_platform_token';

const BASE_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? 'http://localhost:8000/api/platform/v1';

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
    by_plan: { foundation: number; creator: number; studio: number; enterprise: number };
  };
  users: { total: number; active_30_days: number; new_7_days: number };
  workshops: { total: number; by_status: Record<string, number> };
  stripe_note: string;
  recent_audit_events: AuditEvent[];
  generated_at: string;
}

export type OrgStatus = 'active' | 'suspended' | 'inactive';
export type PlanCode = 'foundation' | 'creator' | 'studio' | 'enterprise';

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

// ─── User management types ────────────────────────────────────────────────────

export interface UserListItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  organization_count: number;
}

export interface UserOrg {
  id: number;
  name: string;
  role: string;
  joined_at: string | null;
}

export interface LoginEvent {
  ip_address: string;
  user_agent: string;
  outcome: string;
  created_at: string;
}

export interface UserDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  organizations: UserOrg[];
  login_history: LoginEvent[];
}

export const platformUsers = {
  list: (params?: { search?: string; page?: number }) =>
    api.get<Paginated<UserListItem>>('/users', { params }),
  get: (id: number) => api.get<UserDetail>(`/users/${id}`),
};

// ─── Financials types ─────────────────────────────────────────────────────────

export interface FinancialsOverview {
  mrr_cents: number | null;
  arr_cents: number | null;
  subscriptions: {
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    by_plan: {
      foundation: number;
      creator: number;
      studio: number;
      enterprise: number;
    };
  };
  stripe_webhook_connected: boolean;
}

export interface InvoiceListItem {
  id: number;
  stripe_invoice_id: string;
  organization_id: number;
  organization_name: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  invoice_pdf_url: string | null;
  invoice_date: string | null;
}

export const platformFinancials = {
  overview: () => api.get<FinancialsOverview>('/financials/overview'),
  invoices: (params?: { status?: string; organization_id?: number; page?: number }) =>
    api.get<Paginated<InvoiceListItem>>('/financials/invoices', { params }),
  failedPayments: (params?: { organization_id?: number; date_from?: string; date_to?: string; page?: number }) =>
    api.get<Paginated<FailedPayment> & { stripe_webhook_required?: boolean }>(
      '/financials/failed-payments',
      { params },
    ),
};

// ─── Automation types ─────────────────────────────────────────────────────────

export interface AutomationRule {
  id: number;
  organization_id: number | null;
  organization_name: string | null;
  name: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export const platformAutomations = {
  list: (params?: {
    organization_id?: number;
    trigger_type?: string;
    is_active?: boolean;
    page?: number;
  }) => api.get<Paginated<AutomationRule>>('/automations', { params }),
  get: (id: number) => api.get<AutomationRule>(`/automations/${id}`),
  create: (data: {
    name: string;
    trigger_type: string;
    action_type: string;
    organization_id?: number | null;
    is_active?: boolean;
    conditions_json?: string | null;
    action_config_json?: string | null;
  }) => api.post<AutomationRule>('/automations', data),
  update: (id: number, data: Partial<{
    name: string;
    trigger_type: string;
    action_type: string;
    organization_id: number | null;
    is_active: boolean;
    conditions_json: string | null;
    action_config_json: string | null;
  }>) => api.patch<AutomationRule>(`/automations/${id}`, data),
  delete: (id: number) => api.delete(`/automations/${id}`),
};

// ─── Security event types ─────────────────────────────────────────────────────

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: number;
  event_type: string;
  severity: SecuritySeverity;
  description: string | null;
  organization_id: number | null;
  organization_name: string | null;
  user_id: number | null;
  user_email: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export const platformSecurity = {
  listEvents: (params?: {
    severity?: string;
    event_type?: string;
    organization_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
  }) => api.get<Paginated<SecurityEvent>>('/security/events', { params }),
};

// ─── Platform config types ────────────────────────────────────────────────────

export interface PlatformConfig {
  config_key: string;
  config_value: string;
  description: string | null;
  updated_at: string;
}

export const platformConfig = {
  list: () => api.get<PlatformConfig[]>('/config'),
  update: (key: string, value: string) =>
    api.put<PlatformConfig>(`/config/${key}`, { value }),
};

// ─── Platform admin management types ─────────────────────────────────────────

export interface PlatformAdminEntry {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export const platformAdmins = {
  list: () => api.get<{ data: PlatformAdminEntry[] }>('/admins'),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: Exclude<AdminRole, 'super_admin'>;
  }) => api.post<PlatformAdminEntry>('/admins', data),
  updateRole: (id: number, role: AdminRole) =>
    api.patch<PlatformAdminEntry>(`/admins/${id}/role`, { role }),
  updateStatus: (id: number, is_active: boolean) =>
    api.patch<PlatformAdminEntry>(`/admins/${id}/status`, { is_active }),
};

// ─── Generic API client (returns data directly, not AxiosResponse) ────────────
export const platformApi = {
  get:    <T>(path: string)                     => api.get<T>(path).then(r => r.data),
  post:   <T>(path: string, body?: unknown)     => api.post<T>(path, body).then(r => r.data),
  put:    <T>(path: string, body?: unknown)     => api.put<T>(path, body).then(r => r.data),
  patch:  <T>(path: string, body?: unknown)     => api.patch<T>(path, body).then(r => r.data),
  delete: <T>(path: string)                     => api.delete<T>(path).then(r => r.data),
};

// ─── Payment control types ────────────────────────────────────────────────────

export interface PaymentStatus {
  platform_payments_enabled: boolean;
  enabled_at: string | null;
  orgs_payment_enabled_count: number;
  orgs_stripe_connected_count: number;
  orgs_stripe_charges_enabled_count: number;
  warning: string | null;
}

export interface OrgPaymentStatus {
  organization_id: number;
  organization_name: string;
  org_payments_enabled: boolean;
  stripe_connect: {
    connected: boolean;
    onboarding_status: string | null;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    stripe_account_id: string | null;
    last_webhook_received_at: string | null;
    requirements: string[];
  };
  flags: {
    deposits_enabled: boolean;
    waitlist_payments: boolean;
  };
  effective_payments_active: boolean;
}

export interface TakeRate {
  plan_code: 'foundation' | 'creator' | 'studio' | 'custom';
  display_name: string;
  take_rate_pct: string;
  take_rate_decimal: number;
  fee_on_100: string;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
}

export interface StripeConnectAccount {
  organization_id: number;
  organization_name: string;
  stripe_account_id: string | null;
  onboarding_status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  last_webhook_received_at: string | null;
  has_pending_requirements: boolean;
}

// ─── Health monitoring types ──────────────────────────────────────────────────

export interface SesDeliveryStats {
  sent_30d: number;
  delivered_30d: number;
  bounced_30d: number;
  complained_30d: number;
  bounce_rate_pct: number;
  complaint_rate_pct: number;
  last_updated: string | null;
}

export interface OrgEmailDelivery {
  organization_id: number;
  organization_name: string;
  sent_30d: number;
  bounce_rate_pct: number;
  complaint_rate_pct: number;
  status: 'high_bounce' | 'ok' | 'no_data';
}

export const platformHealth = {
  sesStats: () => api.get<SesDeliveryStats>('/health/ses-stats'),
  emailByOrg: (params?: { min_bounce_rate?: number }) =>
    api.get<OrgEmailDelivery[]>('/health/email-by-org', { params }),
};

// ─── Workshop pricing types ───────────────────────────────────────────────────

export interface WorkshopPricingItem {
  workshop_id: number;
  title: string;
  organization_id: number;
  organization_name: string | null;
  status: string;
  pricing: {
    has_pricing: boolean;
    base_price_cents: number | null;
    currency: string | null;
    deposit_enabled: boolean;
    deposit_amount_cents: number | null;
    active_tier_count: number;
    session_pricing_count: number;
  };
}

export interface AddonSessionPricing {
  session_id: number;
  session_title: string;
  workshop_id: number;
  workshop_title: string;
  session_type: 'addon' | 'invite_only';
  price_cents: number | null;
  deposit_amount_cents: number | null;
}

export const platformWorkshops = {
  pricingAudit: (params?: { organization_id?: number; page?: number }) =>
    api.get<Paginated<WorkshopPricingItem>>('/workshops/pricing-audit', { params }),
  addonPricing: (params?: { organization_id?: number }) =>
    api.get<AddonSessionPricing[]>('/workshops/addon-pricing', { params }),
};

// ─── Failed payments type ─────────────────────────────────────────────────────

export interface FailedPayment {
  id: number;
  organization_id: number;
  organization_name: string;
  amount_cents: number;
  currency: string;
  failure_reason: string | null;
  customer_email: string | null;
  created_at: string;
}

export const platformPayments = {
  status: () =>
    api.get<PaymentStatus>('/payments/status'),
  enable: () =>
    api.post<PaymentStatus>('/payments/enable'),
  disable: () =>
    api.post<PaymentStatus>('/payments/disable'),
  orgStatus: (orgId: number) =>
    api.get<OrgPaymentStatus>(`/organizations/${orgId}/payments`),
  enableOrg: (orgId: number) =>
    api.post<OrgPaymentStatus>(`/organizations/${orgId}/payments/enable`),
  disableOrg: (orgId: number) =>
    api.post<OrgPaymentStatus>(`/organizations/${orgId}/payments/disable`),
  setOrgFlag: (orgId: number, flagKey: string, isEnabled: boolean) =>
    api.patch(`/organizations/${orgId}/payments/flags/${flagKey}`, { is_enabled: isEnabled }),
  takeRates: () =>
    api.get<TakeRate[]>('/payments/take-rates'),
  updateTakeRate: (planCode: string, data: { take_rate_pct: number; notes?: string }) =>
    api.patch<TakeRate>(`/payments/take-rates/${planCode}`, data),
  connectAccounts: (params?: {
    onboarding_status?: string;
    charges_enabled?: boolean;
    page?: number;
  }) =>
    api.get<Paginated<StripeConnectAccount> & { stripe_connect_not_configured?: boolean }>(
      '/payments/connect-accounts',
      { params },
    ),
};
