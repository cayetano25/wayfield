import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';
import OrgsPage from '@/app/(admin)/organizations/page';
import OrgDetailPage from '@/app/(admin)/organizations/[id]/page';
import { UsageBar } from '@/components/ui/UsageBar';

// ─── Mutable role for per-test role control ────────────────────────────────────

let currentRole: platformApi.AdminRole = 'super_admin';

vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: { id: 1, first_name: 'Test', last_name: 'Admin', email: 't@w.io', role: currentRole, is_active: true, can_impersonate: false, last_login_at: null },
    isLoading: false,
    setAdminUser: vi.fn(),
    logout: vi.fn(),
  }),
  can: {
    manageBilling:      (r: string) => ['super_admin', 'billing'].includes(r),
    manageFeatureFlags: (r: string) => ['super_admin', 'admin'].includes(r),
    viewUsers:          (r: string) => ['super_admin', 'admin', 'support'].includes(r),
    viewFinancials:     (r: string) => ['super_admin', 'billing'].includes(r),
    viewSupport:        (r: string) => ['super_admin', 'admin', 'support'].includes(r),
    manageAutomations:  (r: string) => ['super_admin', 'admin'].includes(r),
    viewSecurity:       (r: string) => ['super_admin', 'admin', 'support'].includes(r),
    viewAuditLog:       (r: string) => ['super_admin', 'admin'].includes(r),
    manageSettings:     (r: string) => r === 'super_admin',
  },
}));

vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '3 days ago',
}));

// ─── Navigation mocks ─────────────────────────────────────────────────────────

const mockReplace = vi.fn();
let mockTabParam: string | null = null;
let mockPlanParam: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'tab')    return mockTabParam;
      if (key === 'plan')   return mockPlanParam;
      return null;
    },
    toString: () => '',
  }),
  usePathname: () => '/organizations',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockOrgList: platformApi.Paginated<platformApi.OrgListItem> = {
  data: [
    {
      id: 1, name: 'Cascade Photo Workshops', slug: 'cascade', status: 'active',
      primary_contact_email: 'c@cascade.test', logo_url: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
      workshops_count: 4, active_workshops_count: 3,
      subscription: { id: 1, organization_id: 1, stripe_customer_id: null, stripe_subscription_id: null, billing_cycle: null, current_period_end: null, plan_code: 'starter', status: 'active', starts_at: '2026-01-01T00:00:00Z', ends_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      organization_users: [],
    },
    {
      id: 2, name: 'Pacific NW Photo', slug: 'pnw', status: 'suspended',
      primary_contact_email: null, logo_url: null,
      created_at: '2026-02-01T00:00:00Z', updated_at: '2026-04-02T00:00:00Z',
      workshops_count: 1, active_workshops_count: 0,
      subscription: null, organization_users: [],
    },
  ],
  current_page: 1, per_page: 25, total: 2, last_page: 1, from: 1, to: 2,
};

const mockOrgDetail: platformApi.OrgDetail = {
  id: 1, name: 'Cascade Photo Workshops', slug: 'cascade', status: 'active',
  contact_email: 'c@cascade.test', contact_phone: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  subscription: { plan_code: 'starter', status: 'active', current_period_start: null, current_period_end: null },
  usage: { workshop_count: 4, workshop_limit: 10, participant_count: 120, participant_limit: 250, manager_count: 3, manager_limit: 10 },
};

const mockFlags: platformApi.FeatureFlag[] = [
  { feature_key: 'analytics', description: 'Advanced analytics', is_enabled: false, source: 'plan_default' },
  { feature_key: 'leader_messaging', description: 'Leader messaging', is_enabled: true, source: 'manual_override' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// React 19's use() checks promise.status === 'fulfilled' to return synchronously.
// Pre-marking the promise avoids Suspense in tests where we just want sync params.
function readyPromise<T>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status?: string; value?: T };
  p.status = 'fulfilled';
  p.value = value;
  return p;
}

function renderDetail() {
  return render(<OrgDetailPage params={readyPromise({ id: '1' })} />);
}

// ─── Organisations list ───────────────────────────────────────────────────────

describe('Organisations list', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    currentRole = 'super_admin';
    mockTabParam = null;
    mockPlanParam = null;
    vi.spyOn(platformApi.platformOrganizations, 'list').mockResolvedValue({ data: mockOrgList } as never);
  });

  it('renders org names after load', async () => {
    render(<OrgsPage />);
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.getByText('Pacific NW Photo')).toBeDefined();
  });

  it('clicking org name renders a link to /organizations/{id}', async () => {
    render(<OrgsPage />);
    await waitFor(() => screen.getByText('Cascade Photo Workshops'));
    const link = screen.getByRole('link', { name: 'Cascade Photo Workshops' });
    expect(link.getAttribute('href')).toBe('/organizations/1');
  });

  it('search input calls setParam after debounce', async () => {
    vi.useFakeTimers();
    render(<OrgsPage />);
    await act(async () => {});

    const input = screen.getByPlaceholderText('Search by name or email');
    fireEvent.change(input, { target: { value: 'Cascade' } });

    expect(mockReplace).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockReplace).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('plan filter shows count badge when plans selected', async () => {
    mockPlanParam = 'starter';
    render(<OrgsPage />);
    await waitFor(() => expect(screen.getByText('1')).toBeDefined());
  });

  it('shows empty state when no orgs returned', async () => {
    vi.spyOn(platformApi.platformOrganizations, 'list').mockResolvedValue({
      data: { ...mockOrgList, data: [], total: 0, from: null, to: null },
    } as never);

    render(<OrgsPage />);
    await waitFor(() => expect(screen.getByText('No organisations found')).toBeDefined());
    expect(screen.getByText('Try adjusting your filters.')).toBeDefined();
  });

  it('shows error banner on fetch failure with retry', async () => {
    vi.spyOn(platformApi.platformOrganizations, 'list').mockRejectedValue(new Error('Network error'));

    render(<OrgsPage />);
    await waitFor(() => expect(screen.getByText('Failed to load organisations.')).toBeDefined());
    expect(screen.getByText('Retry')).toBeDefined();
  });
});

// ─── Organisation detail ──────────────────────────────────────────────────────

describe('Organisation detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'super_admin';
    mockTabParam = null;
    vi.spyOn(platformApi.platformOrganizations, 'get').mockResolvedValue({ data: mockOrgDetail } as never);
    vi.spyOn(platformApi.platformOrganizations, 'getFeatureFlags').mockResolvedValue({ data: mockFlags } as never);
    vi.spyOn(platformApi.platformAuditLogs, 'list').mockResolvedValue({
      data: { data: [], total: 0, current_page: 1, per_page: 50, last_page: 1, from: null, to: null },
    } as never);
  });

  it('renders org name, status badge, and plan badge', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Starter').length).toBeGreaterThan(0);
  });

  it('billing tab always shows staleness notice', async () => {
    mockTabParam = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText(/mirrored from Stripe/)).toBeDefined());
  });

  it('Change Plan button visible for super_admin on billing tab', async () => {
    currentRole = 'super_admin';
    mockTabParam = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Change Plan')).toBeDefined());
  });

  it('Change Plan button NOT visible for admin role', async () => {
    currentRole = 'admin';
    mockTabParam = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText(/mirrored from Stripe/)).toBeDefined());
    expect(screen.queryByText('Change Plan')).toBeNull();
  });

  it('Change Plan button NOT visible for support role', async () => {
    currentRole = 'support';
    mockTabParam = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText(/mirrored from Stripe/)).toBeDefined());
    expect(screen.queryByText('Change Plan')).toBeNull();
  });

  it('plan change modal cannot be dismissed by backdrop click', async () => {
    currentRole = 'super_admin';
    mockTabParam = 'billing';
    renderDetail();
    await waitFor(() => screen.getByText('Change Plan'));

    fireEvent.click(screen.getByText('Change Plan'));
    const dialog = await screen.findByRole('dialog');

    // Click the backdrop element itself
    fireEvent.click(dialog);

    // Modal should still be present
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('Feature Flags tab not rendered for billing role', async () => {
    currentRole = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.queryByText('Feature Flags')).toBeNull();
  });

  it('Feature Flags tab not rendered for support role', async () => {
    currentRole = 'support';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.queryByText('Feature Flags')).toBeNull();
  });

  it('Audit tab not rendered for billing role', async () => {
    currentRole = 'billing';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.queryByText('Audit')).toBeNull();
  });

  it('Audit tab not rendered for readonly role', async () => {
    currentRole = 'readonly';
    renderDetail();
    await waitFor(() => expect(screen.getByText('Cascade Photo Workshops')).toBeDefined());
    expect(screen.queryByText('Audit')).toBeNull();
  });
});

// ─── Feature flag toggles ─────────────────────────────────────────────────────

describe('Feature flag toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'super_admin';
    mockTabParam = 'flags';
    vi.spyOn(platformApi.platformOrganizations, 'get').mockResolvedValue({ data: mockOrgDetail } as never);
    vi.spyOn(platformApi.platformOrganizations, 'getFeatureFlags').mockResolvedValue({ data: mockFlags } as never);
  });

  it('optimistic update flips toggle immediately', async () => {
    vi.spyOn(platformApi.platformOrganizations, 'setFeatureFlag').mockResolvedValue({} as never);

    renderDetail();
    await waitFor(() => screen.getByTestId('toggle-analytics'));

    const toggle = screen.getByTestId('toggle-analytics');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    // Optimistic update should flip immediately
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  });

  it('rollback on toggle API failure', async () => {
    vi.spyOn(platformApi.platformOrganizations, 'setFeatureFlag').mockRejectedValue(new Error('Failed'));

    renderDetail();
    await waitFor(() => screen.getByTestId('toggle-analytics'));

    const toggle = screen.getByTestId('toggle-analytics');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    // Should roll back to original value after API failure
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  });
});

// ─── UsageBar colours ─────────────────────────────────────────────────────────

describe('UsageBar', () => {
  it('uses teal bar below 80%', () => {
    render(<UsageBar value={50} limit={100} />);
    expect(screen.getByTestId('usage-bar-fill').className).toContain('bg-[#0FA3B1]');
  });

  it('uses amber bar at 80–99%', () => {
    render(<UsageBar value={85} limit={100} />);
    expect(screen.getByTestId('usage-bar-fill').className).toContain('bg-amber-400');
  });

  it('uses red bar at 100%+', () => {
    render(<UsageBar value={100} limit={100} />);
    expect(screen.getByTestId('usage-bar-fill').className).toContain('bg-red-500');
  });

  it('shows Unlimited label for null limit', () => {
    render(<UsageBar value={5} limit={null} />);
    expect(screen.getByText('Unlimited')).toBeDefined();
  });
});
