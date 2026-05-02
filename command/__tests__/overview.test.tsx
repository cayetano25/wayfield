import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// Mock recharts so PlanChart legend text is visible in jsdom
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
    by_plan: { free: 10, starter: 15, pro: 12, enterprise: 5 },
  },
  users: { total: 1200, active_30_days: 850, new_7_days: 42 },
  workshops: {
    total: 200,
    by_status: { published: 150, draft: 35, archived: 15 },
  },
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

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument(); // total orgs
      expect(screen.getByText('850')).toBeInTheDocument(); // active users 30d
    });
  });

  it('shows loading skeletons while fetching', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockImplementation(() => new Promise(() => {})); // never resolves

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    const { container } = render(<OverviewPage />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error banner on API failure with retry button', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockRejectedValue(new Error('Network error'));

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows billing warning when stripe_note is present', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      // stripe_note text appears in at least one element
      const matches = screen.getAllByText(/stripe|stale|webhook/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('renders plan distribution chart with correct plan names', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      // The mocked Pie renders each entry's name as a span
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });

  it('shows recent platform activity', async () => {
    vi.spyOn(platformApi.platformOverview, 'get').mockResolvedValue({ data: mockOverviewData } as never);

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('feature_flag_override')).toBeInTheDocument();
      expect(screen.getByText(/Tom Admin/i)).toBeInTheDocument();
    });
  });

  it('shows retry button that re-fetches data', async () => {
    const mockGet = vi.spyOn(platformApi.platformOverview, 'get').mockRejectedValue(new Error('fail'));

    const OverviewPage = (await import('@/app/(admin)/overview/page')).default;
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
});
