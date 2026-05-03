import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ data }: { data?: Array<{ name: string }> }) => (
    <div data-testid="bar">
      {data?.map((d) => <span key={d.name}>{d.name}</span>)}
    </div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  Cell: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
  format: (_date: Date, _fmt: string) => 'Jan 1, 2026',
}));

const mockRouterReplace = vi.fn();
// navTab drives the active financials tab for tests that need a specific tab open
let navTab: string | null = null;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? navTab : null),
    toString: () => (navTab ? `tab=${navTab}` : ''),
  }),
}));

vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: vi.fn() }),
}));

// ─── Mutable role for per-test control ────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserList: platformApi.Paginated<platformApi.UserListItem> = {
  data: [
    {
      id: 1,
      first_name: 'Alice',
      last_name: 'Zed',
      email: 'alice@example.com',
      is_active: true,
      email_verified_at: '2026-01-01T00:00:00Z',
      last_login_at: '2026-04-01T12:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      organization_count: 2,
    },
    {
      id: 2,
      first_name: 'Bob',
      last_name: 'Smith',
      email: 'bob@example.com',
      is_active: true,
      email_verified_at: null,
      last_login_at: null,
      created_at: '2026-02-01T00:00:00Z',
      organization_count: 0,
    },
  ],
  current_page: 1, per_page: 25, total: 2, last_page: 1, from: 1, to: 2,
};

const mockUserDetail: platformApi.UserDetail = {
  id: 1,
  first_name: 'Alice',
  last_name: 'Zed',
  email: 'alice@example.com',
  is_active: true,
  email_verified_at: '2026-01-01T00:00:00Z',
  last_login_at: '2026-04-01T12:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  organizations: [
    { id: 10, name: 'Cascade Photo Workshops', role: 'admin', joined_at: '2026-01-15T00:00:00Z' },
  ],
  login_history: [
    { ip_address: '1.2.3.4', user_agent: 'Chrome/130', outcome: 'success', created_at: '2026-04-01T12:00:00Z' },
    { ip_address: '5.6.7.8', user_agent: 'Safari/17', outcome: 'failed', created_at: '2026-03-28T09:00:00Z' },
  ],
};

const mockOverview: platformApi.FinancialsOverview = {
  mrr_cents: 17800,
  arr_cents: 17800 * 12,
  subscriptions: {
    active: 3,
    trialing: 1,
    past_due: 0,
    canceled: 1,
    by_plan: { foundation: 0, creator: 2, studio: 1, enterprise: 0 },
  },
  stripe_webhook_connected: true,
};

const mockInvoices: platformApi.Paginated<platformApi.InvoiceListItem> = {
  data: [
    {
      id: 1,
      stripe_invoice_id: 'in_test_001',
      organization_id: 1,
      organization_name: 'Cascade Photo Workshops',
      amount_due: 4900,
      amount_paid: 4900,
      currency: 'usd',
      status: 'paid',
      invoice_pdf_url: 'https://stripe.com/pdf/001',
      invoice_date: '2026-04-01T00:00:00Z',
    },
  ],
  current_page: 1, per_page: 25, total: 1, last_page: 1, from: 1, to: 1,
};

// ─── Users list ───────────────────────────────────────────────────────────────

describe('Users list', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    mockRouterReplace.mockReset();
    vi.spyOn(platformApi.platformUsers, 'list').mockResolvedValue({ data: mockUserList } as never);
    vi.spyOn(platformApi.platformUsers, 'get').mockResolvedValue({ data: mockUserDetail } as never);
  });

  it('renders table with user rows', async () => {
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Zed')).toBeInTheDocument();
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('renders verified and unverified badges', async () => {
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Zed')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unverified').length).toBeGreaterThanOrEqual(1);
  });

  it('redirects billing role to /', async () => {
    currentRole = 'billing';
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirects readonly role to /', async () => {
    currentRole = 'readonly';
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('does not redirect support role', async () => {
    currentRole = 'support';
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Zed')).toBeInTheDocument();
    });
    expect(mockRouterReplace).not.toHaveBeenCalledWith('/');
  });

  it('debounces search input and calls API with search param', async () => {
    vi.useFakeTimers();
    const listSpy = vi.spyOn(platformApi.platformUsers, 'list').mockResolvedValue({ data: mockUserList } as never);

    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    const input = screen.getByPlaceholderText('Search by name or email');
    fireEvent.change(input, { target: { value: 'alice' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' }),
      );
    });
  });

  it('clicking View opens slide-over with user details', async () => {
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Zed')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText('View →');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('user-slideover')).toBeInTheDocument();
      expect(screen.getByText('Cascade Photo Workshops')).toBeInTheDocument();
    });
  });
});

// ─── UserSlideOver ────────────────────────────────────────────────────────────

describe('UserSlideOver', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    vi.spyOn(platformApi.platformUsers, 'list').mockResolvedValue({ data: mockUserList } as never);
    vi.spyOn(platformApi.platformUsers, 'get').mockResolvedValue({ data: mockUserDetail } as never);
  });

  async function openSlideOver() {
    const UsersPage = (await import('@/app/(admin)/users/page')).default;
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Zed')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('View →')[0]);
    await waitFor(() => expect(screen.getByTestId('user-slideover')).toBeInTheDocument());
  }

  it('renders org memberships and login history', async () => {
    await openSlideOver();
    expect(screen.getByText('Cascade Photo Workshops')).toBeInTheDocument();
    expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
  });

  it('renders success outcome badge as teal', async () => {
    await openSlideOver();
    const successBadge = screen.getByText('success');
    expect(successBadge.closest('span')).toHaveClass('text-teal-700');
  });

  it('renders failed outcome badge as amber', async () => {
    await openSlideOver();
    const failedBadge = screen.getByText('failed');
    expect(failedBadge.closest('span')).toHaveClass('text-amber-700');
  });

  it('closes slide-over when X button is clicked', async () => {
    await openSlideOver();

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    await waitFor(() => {
      const panel = screen.getByTestId('user-slideover');
      expect(panel).toHaveClass('translate-x-full');
    });
  });

  it('closes slide-over when backdrop is clicked', async () => {
    await openSlideOver();

    const backdrop = screen.getByTestId('slideover-backdrop');
    fireEvent.click(backdrop);

    await waitFor(() => {
      const panel = screen.getByTestId('user-slideover');
      expect(panel).toHaveClass('translate-x-full');
    });
  });
});

// ─── Financials page ──────────────────────────────────────────────────────────

describe('Financials page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    navTab = null;
    mockRouterReplace.mockReset();
    vi.spyOn(platformApi.platformFinancials, 'overview').mockResolvedValue({ data: mockOverview } as never);
    vi.spyOn(platformApi.platformFinancials, 'invoices').mockResolvedValue({ data: mockInvoices } as never);
  });

  it('shows staleness notice always', async () => {
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    expect(
      screen.getByText(/Billing data is sourced from Stripe mirror tables/),
    ).toBeInTheDocument();
  });

  it('does not show webhook warning when connected', async () => {
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Stripe webhook is not connected/)).not.toBeInTheDocument();
    });
  });

  it('shows webhook warning when not connected', async () => {
    vi.spyOn(platformApi.platformFinancials, 'overview').mockResolvedValue({
      data: { ...mockOverview, stripe_webhook_connected: false },
    } as never);

    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Stripe webhook is not connected/)).toBeInTheDocument();
    });
  });

  it('renders MRR and ARR stat cards', async () => {
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText('MRR')).toBeInTheDocument();
    });
    expect(screen.getByText('ARR')).toBeInTheDocument();
  });

  it('shows null MRR as dash when no subscriptions', async () => {
    vi.spyOn(platformApi.platformFinancials, 'overview').mockResolvedValue({
      data: { ...mockOverview, mrr_cents: null, arr_cents: null },
    } as never);

    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText('MRR')).toBeInTheDocument();
    });
    // Both MRR and ARR show "—" when null
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('renders invoice table with org name', async () => {
    navTab = 'invoices';
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cascade Photo Workshops')).toBeInTheDocument();
    });
    expect(screen.getByText('in_test_001')).toBeInTheDocument();
  });

  it('filters invoices by status', async () => {
    navTab = 'invoices';
    const invoicesSpy = vi.spyOn(platformApi.platformFinancials, 'invoices').mockResolvedValue({ data: mockInvoices } as never);

    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cascade Photo Workshops')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('All Statuses');
    fireEvent.change(select, { target: { value: 'paid' } });

    await waitFor(() => {
      expect(invoicesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid' }),
      );
    });
  });

  it('redirects admin role to /', async () => {
    currentRole = 'admin';
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirects support role to /', async () => {
    currentRole = 'support';
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('does not redirect billing role', async () => {
    currentRole = 'billing';
    const FinancialsPage = (await import('@/app/(admin)/financials/page')).default;
    render(<FinancialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Billing data is sourced from Stripe mirror tables/)).toBeInTheDocument();
    });
    expect(mockRouterReplace).not.toHaveBeenCalledWith('/');
  });
});

// ─── Support page ─────────────────────────────────────────────────────────────

describe('Support page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    mockRouterReplace.mockReset();
  });

  it('renders disabled button when NEXT_PUBLIC_SUPPORT_TOOL_URL is not set', async () => {
    const SupportPage = (await import('@/app/(admin)/support/page')).default;
    render(<SupportPage />);

    const btn = screen.getByRole('button', { name: /support tool url not configured/i });
    expect(btn).toBeDisabled();
  });

  it('shows env-var hint when URL is not set', async () => {
    const SupportPage = (await import('@/app/(admin)/support/page')).default;
    render(<SupportPage />);

    expect(screen.getByText(/NEXT_PUBLIC_SUPPORT_TOOL_URL/)).toBeInTheDocument();
  });

  it('redirects readonly role to /', async () => {
    currentRole = 'readonly';
    const SupportPage = (await import('@/app/(admin)/support/page')).default;
    render(<SupportPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('does not redirect admin role', async () => {
    currentRole = 'admin';
    const SupportPage = (await import('@/app/(admin)/support/page')).default;
    render(<SupportPage />);

    expect(mockRouterReplace).not.toHaveBeenCalledWith('/');
  });
});
