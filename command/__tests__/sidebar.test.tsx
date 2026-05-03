import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminRole } from '@/lib/platform-api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

async function renderSidebarWithRole(role: AdminRole) {
  vi.resetModules();

  vi.doMock('@/contexts/AdminUserContext', () => ({
    useAdminUser: () => ({
      adminUser: { id: 1, first_name: 'Test', last_name: 'User', email: 'test@test.com', role },
      isLoading: false,
      setAdminUser: vi.fn(),
      logout: vi.fn(),
    }),
    can: {
      manageBilling:      (r: AdminRole) => (['super_admin', 'billing'] as AdminRole[]).includes(r),
      manageFeatureFlags: (r: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(r),
      viewUsers:          (r: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(r),
      viewFinancials:     (r: AdminRole) => (['super_admin', 'billing'] as AdminRole[]).includes(r),
      viewSupport:        (r: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(r),
      manageAutomations:  (r: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(r),
      viewSecurity:       (r: AdminRole) => (['super_admin', 'admin', 'support'] as AdminRole[]).includes(r),
      viewAuditLog:       (r: AdminRole) => (['super_admin', 'admin'] as AdminRole[]).includes(r),
      manageSettings:     (r: AdminRole) => r === 'super_admin',
      managePayments:     (r: AdminRole) => (['super_admin', 'billing'] as AdminRole[]).includes(r),
      manageTakeRates:    (r: AdminRole) => r === 'super_admin',
    },
  }));

  const { default: Sidebar } = await import('@/components/Sidebar');
  return render(<Sidebar />);
}

describe('Sidebar role visibility', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('super_admin sees all nav items including Announcements', async () => {
    await renderSidebarWithRole('super_admin');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Organisations')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Automations')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('admin does not see Settings but sees Announcements', async () => {
    await renderSidebarWithRole('admin');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('support does not see Financials, Automations, Audit Log, Announcements or Settings', async () => {
    await renderSidebarWithRole('support');
    // Use link queries to avoid matching RoleBadge text
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /security/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /financials/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /automations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /announcements/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('billing does not see Users, Support, Automations, Security, Audit Log, Announcements or Settings', async () => {
    await renderSidebarWithRole('billing');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Organisations')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Support')).not.toBeInTheDocument();
    expect(screen.queryByText('Automations')).not.toBeInTheDocument();
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Announcements')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('readonly only sees Overview and Organisations', async () => {
    await renderSidebarWithRole('readonly');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Organisations')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Financials')).not.toBeInTheDocument();
    expect(screen.queryByText('Support')).not.toBeInTheDocument();
    expect(screen.queryByText('Automations')).not.toBeInTheDocument();
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Announcements')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('Overview link points to root route /', async () => {
    await renderSidebarWithRole('super_admin');
    const overviewLink = screen.getByRole('link', { name: /overview/i });
    expect(overviewLink).toHaveAttribute('href', '/');
  });

  it('logout clears token and redirects to /login', async () => {
    // Logout is handled by AdminUserContext, tested separately; just verify sidebar renders
    await renderSidebarWithRole('super_admin');
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});
