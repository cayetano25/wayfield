import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// ─── Global mocks ─────────────────────────────────────────────────────────────

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
  format: () => 'Jan 1, 2026',
}));

const mockRouterReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
}));

const mockToastShow = vi.fn();
vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ show: mockToastShow }),
}));

let currentRole: platformApi.AdminRole = 'super_admin';
let currentUserId = 1;

vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: {
      id: currentUserId,
      first_name: 'Test',
      last_name: 'Admin',
      email: 't@w.io',
      role: currentRole,
      is_active: true,
      can_impersonate: false,
      last_login_at: null,
    },
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

const makeRuleList = (): platformApi.Paginated<platformApi.AutomationRule> => ({
  data: [
    {
      id: 1,
      organization_id: null,
      organization_name: null,
      name: 'Trial Expiry Alert',
      trigger_type: 'trial_expired',
      action_type: 'send_email',
      is_active: true,
      last_run_at: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      organization_id: 5,
      organization_name: 'Acme Corp',
      name: 'Inactive Org Cleanup',
      trigger_type: 'org_inactive_60d',
      action_type: 'flag_for_review',
      is_active: false,
      last_run_at: '2026-04-10T08:00:00Z',
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
  current_page: 1, per_page: 25, total: 2, last_page: 1, from: 1, to: 2,
});

const makeSecurityList = (): platformApi.Paginated<platformApi.SecurityEvent> => ({
  data: [
    {
      id: 1,
      event_type: 'suspicious_login',
      severity: 'high',
      description: 'Multiple failed attempts',
      organization_id: 1,
      organization_name: 'Cascade Photo',
      user_id: 42,
      user_email: 'bob@example.com',
      metadata_json: { attempts: 5 },
      created_at: '2026-04-01T12:00:00Z',
    },
    {
      id: 2,
      event_type: 'account_locked',
      severity: 'critical',
      description: 'Account locked after 10 failures',
      organization_id: null,
      organization_name: null,
      user_id: null,
      user_email: null,
      metadata_json: null,
      created_at: '2026-04-02T10:00:00Z',
    },
  ],
  current_page: 1, per_page: 50, total: 2, last_page: 1, from: 1, to: 2,
});

const makeAuditList = (): platformApi.Paginated<platformApi.PlatformAuditLog> => ({
  data: [
    {
      id: 1,
      action: 'platform_config.updated',
      entity_type: 'platform_config',
      entity_id: null,
      admin_user_id: 1,
      admin_name: 'Test Admin',
      organization_id: null,
      organization_name: null,
      metadata_json: { old: 'http://old.example.com', new: 'http://new.example.com' },
      ip_address: '1.2.3.4',
      created_at: '2026-04-01T12:00:00Z',
    },
    {
      id: 2,
      action: 'admin_user.created',
      entity_type: 'admin_user',
      entity_id: 5,
      admin_user_id: 1,
      admin_name: 'Test Admin',
      organization_id: null,
      organization_name: null,
      metadata_json: null,
      ip_address: '1.2.3.4',
      created_at: '2026-04-02T08:00:00Z',
    },
  ],
  current_page: 1, per_page: 25, total: 2, last_page: 1, from: 1, to: 2,
});

const makeConfigList = (): platformApi.PlatformConfig[] => [
  { config_key: 'support_tool_url', config_value: 'https://help.example.com', description: 'Support tool URL', updated_at: '2026-04-01T00:00:00Z' },
  { config_key: 'maintenance_mode', config_value: '', description: 'Enable maintenance mode', updated_at: '2026-04-01T00:00:00Z' },
];

const makeAdminList = (): { data: platformApi.PlatformAdminEntry[] } => ({
  data: [
    { id: 1, first_name: 'Test', last_name: 'Admin', email: 't@w.io', role: 'super_admin', is_active: true, last_login_at: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 2, first_name: 'Alice', last_name: 'Support', email: 'alice@w.io', role: 'support', is_active: true, last_login_at: '2026-04-01T12:00:00Z', created_at: '2026-02-01T00:00:00Z' },
  ],
});

// ─── Automations ──────────────────────────────────────────────────────────────

describe('Automations page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    currentUserId = 1;
    mockRouterReplace.mockReset();
    mockToastShow.mockReset();
    vi.spyOn(platformApi.platformAutomations, 'list').mockResolvedValue({ data: makeRuleList() } as never);
    vi.spyOn(platformApi.platformAutomations, 'update').mockResolvedValue({ data: { ...makeRuleList().data[0], is_active: false } } as never);
    vi.spyOn(platformApi.platformAutomations, 'delete').mockResolvedValue({ status: 204 } as never);
  });

  it('renders automation rules table', async () => {
    const AutomationsPage = (await import('@/app/(admin)/automations/page')).default;
    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Trial Expiry Alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Inactive Org Cleanup')).toBeInTheDocument();
    expect(screen.getByText('trial_expired')).toBeInTheDocument();
  });

  it('shows engine notice banner', async () => {
    const AutomationsPage = (await import('@/app/(admin)/automations/page')).default;
    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/automation execution engine is not yet wired/i)).toBeInTheDocument();
    });
  });

  it('redirects billing role to /', async () => {
    currentRole = 'billing';
    const AutomationsPage = (await import('@/app/(admin)/automations/page')).default;
    render(<AutomationsPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('opens rule editor slide-over when Edit is clicked', async () => {
    const AutomationsPage = (await import('@/app/(admin)/automations/page')).default;
    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Trial Expiry Alert')).toBeInTheDocument();
    });

    const editBtn = screen.getAllByLabelText(/Edit Trial Expiry Alert/i)[0] ?? screen.getAllByText('Edit')[0];
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByTestId('rule-editor-slideover')).toBeInTheDocument();
    });
  });

  it('shows confirm modal when Delete is clicked', async () => {
    const AutomationsPage = (await import('@/app/(admin)/automations/page')).default;
    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Trial Expiry Alert')).toBeInTheDocument();
    });

    const deleteBtn = screen.getAllByLabelText(/Delete Trial Expiry Alert/i)[0] ?? screen.getAllByText('Delete')[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete Automation Rule')).toBeInTheDocument();
    });
  });
});

// ─── Security Events ──────────────────────────────────────────────────────────

describe('Security events page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    mockRouterReplace.mockReset();
    vi.spyOn(platformApi.platformSecurity, 'listEvents').mockResolvedValue({ data: makeSecurityList() } as never);
  });

  it('renders security events table with severity badges', async () => {
    const SecurityPage = (await import('@/app/(admin)/security/page')).default;
    render(<SecurityPage />);

    await waitFor(() => {
      expect(screen.getByText('suspicious_login')).toBeInTheDocument();
    });
    expect(screen.getByText('account_locked')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('passes severity filter to API when selected', async () => {
    const listSpy = vi.spyOn(platformApi.platformSecurity, 'listEvents').mockResolvedValue({ data: makeSecurityList() } as never);
    const SecurityPage = (await import('@/app/(admin)/security/page')).default;
    render(<SecurityPage />);

    await waitFor(() => expect(screen.getByText('suspicious_login')).toBeInTheDocument());

    // Open severity filter and select 'critical'
    const filterBtn = screen.getByRole('button', { name: /severity/i });
    fireEvent.click(filterBtn);

    // Find the checkbox inside the dropdown whose label text contains 'critical'
    const criticalCheckbox = screen.getAllByRole('checkbox').find(
      (el) => el.closest('label')?.textContent?.toLowerCase().includes('critical')
    );
    expect(criticalCheckbox).toBeDefined();
    fireEvent.click(criticalCheckbox!);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical' }));
    });
  });

  it('redirects support to / is false — support CAN view security', async () => {
    currentRole = 'support';
    const SecurityPage = (await import('@/app/(admin)/security/page')).default;
    render(<SecurityPage />);

    await waitFor(() => {
      expect(screen.getByText('suspicious_login')).toBeInTheDocument();
    });
    expect(mockRouterReplace).not.toHaveBeenCalledWith('/');
  });

  it('redirects billing role to /', async () => {
    currentRole = 'billing';
    const SecurityPage = (await import('@/app/(admin)/security/page')).default;
    render(<SecurityPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

describe('Audit log page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    mockRouterReplace.mockReset();
    vi.spyOn(platformApi.platformAuditLogs, 'list').mockResolvedValue({ data: makeAuditList() } as never);
  });

  it('renders audit log entries', async () => {
    const AuditPage = (await import('@/app/(admin)/audit/page')).default;
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('platform_config.updated')).toBeInTheDocument();
    });
    expect(screen.getByText('admin_user.created')).toBeInTheDocument();
  });

  it('expands row to show metadata JSON when clicked', async () => {
    const AuditPage = (await import('@/app/(admin)/audit/page')).default;
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('platform_config.updated')).toBeInTheDocument();
    });

    // Click on the first row which has metadata_json with old/new
    const rows = screen.getAllByRole('row');
    const dataRow = rows.find((r) => r.textContent?.includes('platform_config.updated'));
    if (dataRow) fireEvent.click(dataRow);

    await waitFor(() => {
      // Should show "Previous" or "New" section
      expect(
        screen.queryByText(/previous/i) ?? screen.queryByText(/new/i)
      ).toBeTruthy();
    });
  });

  it('shows Export CSV button', async () => {
    const AuditPage = (await import('@/app/(admin)/audit/page')).default;
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Export CSV')).toBeInTheDocument();
    });
  });

  it('redirects readonly role to /', async () => {
    currentRole = 'readonly';
    const AuditPage = (await import('@/app/(admin)/audit/page')).default;
    render(<AuditPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe('Settings page', () => {
  beforeEach(() => {
    vi.useRealTimers();
    currentRole = 'super_admin';
    currentUserId = 1;
    mockRouterReplace.mockReset();
    mockToastShow.mockReset();
    vi.spyOn(platformApi.platformConfig, 'list').mockResolvedValue({ data: makeConfigList() } as never);
    vi.spyOn(platformApi.platformAdmins, 'list').mockResolvedValue({ data: makeAdminList() } as never);
    vi.spyOn(platformApi.platformConfig, 'update').mockResolvedValue({ data: { ...makeConfigList()[0], config_value: 'https://updated.example.com' } } as never);
    vi.spyOn(platformApi.platformAdmins, 'create').mockResolvedValue({
      data: { id: 99, first_name: 'New', last_name: 'Admin', email: 'new@w.io', role: 'support' as platformApi.AdminRole, is_active: true, last_login_at: null, created_at: '2026-05-01T00:00:00Z' },
    } as never);
  });

  it('renders config keys and admin list', async () => {
    const SettingsPage = (await import('@/app/(admin)/settings/page')).default;
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('support_tool_url')).toBeInTheDocument();
    });
    expect(screen.getByText('maintenance_mode')).toBeInTheDocument();
    expect(screen.getByText('Alice Support')).toBeInTheDocument();
  });

  it('shows inline edit input when pencil is clicked', async () => {
    const SettingsPage = (await import('@/app/(admin)/settings/page')).default;
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('support_tool_url')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByLabelText(/Edit support_tool_url/i);
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Edit support_tool_url/i })).toBeInTheDocument();
    });
  });

  it('opens invite admin modal when Add Admin is clicked', async () => {
    const SettingsPage = (await import('@/app/(admin)/settings/page')).default;
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Support')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Admin'));

    await waitFor(() => {
      expect(screen.getByText('Add Platform Admin')).toBeInTheDocument();
    });
  });

  it('redirects admin role to /', async () => {
    currentRole = 'admin';
    const SettingsPage = (await import('@/app/(admin)/settings/page')).default;
    render(<SettingsPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});
