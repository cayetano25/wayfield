import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// Mock recharts so PlanChart data labels are visible in jsdom
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: { data: Array<{ name: string; value: number }> }) => (
    <div data-testid="pie">
      {data?.map((d) => <span key={d.name}>{d.name}</span>)}
    </div>
  ),
  Cell: () => null,
  Tooltip: () => null,
  Legend: ({ payload }: { payload?: Array<{ value: string }> }) => (
    <div data-testid="legend">
      {payload?.map((p) => <span key={p.value}>{p.value}</span>)}
    </div>
  ),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockOverviewData = {
  organizations: {
    total: 42,
    by_status: { active: 38, suspended: 4 },
    by_plan: { foundation: 10, creator: 15, studio: 12, enterprise: 5 },
  },
  users: { total: 1200, active_30_days: 850, new_7_days: 42 },
  workshops: {
    total: 200,
    by_status: { published: 150, draft: 35, archived: 15 },
  },
  mrr_cents: null,
  stripe_note: 'Plan data reflects Stripe mirror tables. May be stale until webhook handler is wired.',
  recent_audit_events: [
    { id: 1, action: 'feature_flag_override', admin_name: 'Tom Admin', organization_name: 'Acme Corp', created_at: new Date().toISOString() },
  ],
  generated_at: new Date().toISOString(),
};

vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: { id: 1, first_name: 'Tom', last_name: 'Admin', email: 'tom@w.io', role: 'super_admin' },
    isLoading: false,
    setAdminUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('Overview dashboard', () => {
  beforeEach(() => {
    vi.spyOn(platformApi.platformOverview, 'get').mockReset();
  });

  it('renders stat cards with correct values', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument(); // total orgs
      expect(screen.getByText('850')).toBeInTheDocument(); // active users 30d
    });
  });

  it('shows loading skeletons while fetching', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockImplementation(() => new Promise(() => {}));

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    const { container } = render(<OverviewPage />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error banner on API failure with retry button', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockRejectedValue(new Error('Network error'));

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows billing warning when mrr_cents is null', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      // MRR card shows stripe_note or "Stripe webhook not connected"
      const matches = screen.getAllByText(/stripe|stale|webhook/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('renders plan distribution chart with display names Foundation/Creator/Studio/Enterprise', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      // Mocked Pie renders each entry's display name as a span
      expect(screen.getAllByText(/Foundation/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Creator/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Studio/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Enterprise/).length).toBeGreaterThan(0);
    });
  });

  it('does not use raw plan codes (free/starter/pro) as display text', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.queryByText(/^Free$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Starter$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Pro$/)).not.toBeInTheDocument();
    });
  });

  it('shows recent platform activity', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('feature_flag_override')).toBeInTheDocument();
      expect(screen.getByText(/Tom Admin/i)).toBeInTheDocument();
    });
  });

  it('shows retry button that re-fetches data', async () => {
    const mockGet = vi.spyOn(platformApi.platformOverview, 'get').mockRejectedValue(new Error('fail'));

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    mockGet.mockResolvedValue({ data: mockOverviewData } as never);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('shows MRR value when mrr_cents is present', async () => {
    const dataWithMrr = { ...mockOverviewData, mrr_cents: 490000 }; // $4900.00
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: dataWithMrr } as never);

    const OverviewPage = (await import('@/app/(admin)/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('$4900.00')).toBeInTheDocument();
    });
  });
});
