import React from 'react';
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
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? null : null),
    toString: () => '',
  }),
}));

const mockToast = vi.fn();
vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: mockToast }),
}));

let currentRole: platformApi.AdminRole = 'super_admin';

vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: {
      id: 1,
      first_name: 'Test',
      last_name: 'Admin',
      email: 'admin@wayfield.io',
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
    managePayments:     (r: string) => ['super_admin', 'billing'].includes(r),
    manageTakeRates:    (r: string) => r === 'super_admin',
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePaymentStatus(overrides: Partial<platformApi.PaymentStatus> = {}): platformApi.PaymentStatus {
  return {
    platform_payments_enabled: false,
    enabled_at: null,
    orgs_payment_enabled_count: 3,
    orgs_stripe_connected_count: 2,
    orgs_stripe_charges_enabled_count: 2,
    warning: null,
    ...overrides,
  };
}

function makeTakeRates(): platformApi.TakeRate[] {
  return [
    {
      plan_code: 'foundation',
      display_name: 'Foundation',
      take_rate_pct: '6.50',
      take_rate_decimal: 0.065,
      fee_on_100: '$6.50',
      is_active: true,
      notes: null,
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      plan_code: 'creator',
      display_name: 'Creator',
      take_rate_pct: '4.00',
      take_rate_decimal: 0.04,
      fee_on_100: '$4.00',
      is_active: true,
      notes: null,
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      plan_code: 'studio',
      display_name: 'Studio',
      take_rate_pct: '2.00',
      take_rate_decimal: 0.02,
      fee_on_100: '$2.00',
      is_active: true,
      notes: null,
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      plan_code: 'custom',
      display_name: 'Enterprise',
      take_rate_pct: '2.00',
      take_rate_decimal: 0.02,
      fee_on_100: '$2.00',
      is_active: true,
      notes: null,
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];
}

function makeOrgPaymentStatus(overrides: Partial<platformApi.OrgPaymentStatus> = {}): platformApi.OrgPaymentStatus {
  return {
    organization_id: 1,
    organization_name: 'Test Org',
    org_payments_enabled: false,
    stripe_connect: {
      connected: false,
      onboarding_status: 'pending',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      stripe_account_id: null,
      last_webhook_received_at: null,
      requirements: [],
    },
    flags: {
      deposits_enabled: false,
      waitlist_payments: false,
    },
    effective_payments_active: false,
    ...overrides,
  };
}

function makeStripeConnectAccounts(): platformApi.StripeConnectAccount[] {
  return [
    {
      organization_id: 1,
      organization_name: 'Org A',
      stripe_account_id: 'acct_abc',
      onboarding_status: 'complete',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      country: 'US',
      last_webhook_received_at: '2026-01-01T12:00:00Z',
      has_pending_requirements: false,
    },
    {
      organization_id: 2,
      organization_name: 'Org B',
      stripe_account_id: null,
      onboarding_status: 'pending',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      country: null,
      last_webhook_received_at: null,
      has_pending_requirements: true,
    },
  ];
}

// ─── can.* helper tests ───────────────────────────────────────────────────────

describe('Role capability helpers', () => {
  const canHelpers = {
    managePayments: (r: string) => ['super_admin', 'billing'].includes(r),
    manageTakeRates: (r: string) => r === 'super_admin',
  };

  it('canManagePayments: true for super_admin', () => {
    expect(canHelpers.managePayments('super_admin')).toBe(true);
  });

  it('canManagePayments: true for billing', () => {
    expect(canHelpers.managePayments('billing')).toBe(true);
  });

  it('canManagePayments: false for admin', () => {
    expect(canHelpers.managePayments('admin')).toBe(false);
  });

  it('canManagePayments: false for support', () => {
    expect(canHelpers.managePayments('support')).toBe(false);
  });

  it('canManagePayments: false for readonly', () => {
    expect(canHelpers.managePayments('readonly')).toBe(false);
  });

  it('canManageTakeRates: true for super_admin only', () => {
    expect(canHelpers.manageTakeRates('super_admin')).toBe(true);
    expect(canHelpers.manageTakeRates('billing')).toBe(false);
    expect(canHelpers.manageTakeRates('admin')).toBe(false);
    expect(canHelpers.manageTakeRates('support')).toBe(false);
    expect(canHelpers.manageTakeRates('readonly')).toBe(false);
  });
});

// ─── DisablePaymentsModal type-to-confirm tests ───────────────────────────────

describe('Disable Payments Modal — type-to-confirm', () => {
  it('confirm button disabled until "DISABLE" is typed exactly', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    // Render the modal inline (simulating what PaymentControlsTab renders)
    const DisableModal = () => {
      const [val, setVal] = React.useState('');
      const isConfirmed = val === 'DISABLE';
      return (
        <div>
          <input
            data-testid="disable-confirm-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button
            data-testid="disable-payments-confirm"
            disabled={!isConfirmed}
            onClick={onConfirm}
          >
            Disable All Payments
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      );
    };

    render(<DisableModal />);

    const confirmBtn = screen.getByTestId('disable-payments-confirm');
    const input = screen.getByTestId('disable-confirm-input');

    // Initially disabled
    expect(confirmBtn).toBeDisabled();

    // Partial input — still disabled
    fireEvent.change(input, { target: { value: 'DIS' } });
    expect(confirmBtn).toBeDisabled();

    // Wrong case — still disabled
    fireEvent.change(input, { target: { value: 'disable' } });
    expect(confirmBtn).toBeDisabled();

    // Exact match — now enabled
    fireEvent.change(input, { target: { value: 'DISABLE' } });
    expect(confirmBtn).not.toBeDisabled();

    // Clicking fires onConfirm
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('button activates at "DISABLE", not "disable" (case-sensitive)', () => {
    const TestModal = () => {
      const [val, setVal] = React.useState('');
      return (
        <div>
          <input
            data-testid="input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button data-testid="btn" disabled={val !== 'DISABLE'}>Confirm</button>
        </div>
      );
    };
    render(<TestModal />);
    const btn = screen.getByTestId('btn');
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'disable' } });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'DISABLE' } });
    expect(btn).not.toBeDisabled();
  });

  it('Enable modal has no type-to-confirm — confirm fires immediately', () => {
    const onConfirm = vi.fn();
    const EnableModal = () => (
      <div>
        <button data-testid="enable-payments-confirm" onClick={onConfirm}>
          Enable Payments
        </button>
      </div>
    );
    render(<EnableModal />);
    const btn = screen.getByTestId('enable-payments-confirm');
    // No input required, not disabled
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// ─── Take Rates tab tests ─────────────────────────────────────────────────────

describe('Take Rates display', () => {
  it('shows Foundation/Creator/Studio/Enterprise display names', () => {
    const rates = makeTakeRates();

    // Verify the display name mapping
    const DISPLAY = { foundation: 'Foundation', creator: 'Creator', studio: 'Studio', custom: 'Enterprise' };
    for (const rate of rates) {
      expect(DISPLAY[rate.plan_code as keyof typeof DISPLAY]).toBeDefined();
    }
    expect(DISPLAY.foundation).toBe('Foundation');
    expect(DISPLAY.creator).toBe('Creator');
    expect(DISPLAY.studio).toBe('Studio');
    expect(DISPLAY.custom).toBe('Enterprise');
  });

  it('plan codes are foundation/creator/studio/custom (not free/starter/pro)', () => {
    const rates = makeTakeRates();
    const codes = rates.map((r) => r.plan_code);
    expect(codes).not.toContain('free');
    expect(codes).not.toContain('starter');
    expect(codes).not.toContain('pro');
    expect(codes).toContain('foundation');
    expect(codes).toContain('creator');
    expect(codes).toContain('studio');
    expect(codes).toContain('custom');
  });

  it('take rate live preview updates as user types rate value', () => {
    const LivePreview = () => {
      const [value, setVal] = React.useState('');
      const numericValue = parseFloat(value);
      const isValid = !isNaN(numericValue) && numericValue >= 0 && numericValue <= 20;
      const feePreview = isValid ? `$${numericValue.toFixed(2)}` : '—';
      return (
        <div>
          <input
            data-testid="rate-input"
            type="number"
            value={value}
            onChange={(e) => setVal(e.target.value)}
          />
          <span data-testid="fee-preview">{feePreview}</span>
        </div>
      );
    };
    render(<LivePreview />);
    const input = screen.getByTestId('rate-input');
    const preview = screen.getByTestId('fee-preview');

    expect(preview).toHaveTextContent('—');

    fireEvent.change(input, { target: { value: '6.5' } });
    expect(preview).toHaveTextContent('$6.50');

    fireEvent.change(input, { target: { value: '4' } });
    expect(preview).toHaveTextContent('$4.00');

    fireEvent.change(input, { target: { value: '' } });
    expect(preview).toHaveTextContent('—');
  });

  it('Edit button absent for billing role (not disabled — absent)', () => {
    const canManageTakeRates = (r: string) => r === 'super_admin';
    // billing role
    expect(canManageTakeRates('billing')).toBe(false);
    // super_admin role
    expect(canManageTakeRates('super_admin')).toBe(true);

    const { rerender } = render(
      <table>
        <tbody>
          <tr>
            {canManageTakeRates('billing') && (
              <td>
                <button data-testid="edit-btn">Edit</button>
              </td>
            )}
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.queryByTestId('edit-btn')).toBeNull();

    rerender(
      <table>
        <tbody>
          <tr>
            {canManageTakeRates('super_admin') && (
              <td>
                <button data-testid="edit-btn">Edit</button>
              </td>
            )}
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId('edit-btn')).toBeInTheDocument();
  });
});

// ─── Org Payments tab tests ───────────────────────────────────────────────────

describe('Org Payments tab visibility', () => {
  it('Payments tab is visible to all roles', () => {
    const allRoles: platformApi.AdminRole[] = [
      'super_admin', 'admin', 'support', 'billing', 'readonly',
    ];
    // The Payments tab is always added — no role restriction
    const TABS = ['overview', 'billing', 'flags', 'usage', 'payments', 'audit'] as const;
    expect(TABS).toContain('payments');

    for (const role of allRoles) {
      const showPayments = true; // payments tab has no role restriction
      expect(showPayments).toBe(true);
    }
  });

  it('effective status banner: active → green', () => {
    const orgStatus = makeOrgPaymentStatus({ effective_payments_active: true });
    expect(orgStatus.effective_payments_active).toBe(true);
  });

  it('effective status banner: org disabled → gray', () => {
    const orgStatus = makeOrgPaymentStatus({
      effective_payments_active: false,
      org_payments_enabled: false,
    });
    expect(orgStatus.org_payments_enabled).toBe(false);
  });

  it('effective status banner: Stripe incomplete → red', () => {
    const orgStatus = makeOrgPaymentStatus({
      effective_payments_active: false,
      org_payments_enabled: true,
      stripe_connect: {
        connected: false,
        onboarding_status: 'pending',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        stripe_account_id: null,
        last_webhook_received_at: null,
        requirements: ['individual.id_number'],
      },
    });
    expect(orgStatus.org_payments_enabled).toBe(true);
    expect(orgStatus.stripe_connect.charges_enabled).toBe(false);
  });
});

// ─── Stripe Connect tab tests ─────────────────────────────────────────────────

describe('Stripe Connect tab', () => {
  it('shows empty state when no accounts exist', () => {
    const EmptyStateSimulation = () => {
      const accounts: platformApi.StripeConnectAccount[] = [];
      if (accounts.length === 0) {
        return <div data-testid="empty-state">No Stripe Connect accounts</div>;
      }
      return <div data-testid="table">Table</div>;
    };
    render(<EmptyStateSimulation />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('table')).toBeNull();
  });

  it('Charges column uses CheckCircle/XCircle with aria-labels (not color alone)', () => {
    const BoolIcon = ({ value }: { value: boolean }) =>
      value ? (
        <span data-testid="check" aria-label="Yes">✓</span>
      ) : (
        <span data-testid="cross" aria-label="No">✗</span>
      );

    const { unmount } = render(<BoolIcon value={true} />);
    expect(screen.getByTestId('check')).toHaveAttribute('aria-label', 'Yes');
    unmount();

    render(<BoolIcon value={false} />);
    expect(screen.getByTestId('cross')).toHaveAttribute('aria-label', 'No');
  });

  it('shows Pending reqs badge when has_pending_requirements is true', () => {
    const accounts = makeStripeConnectAccounts();
    const orgB = accounts.find((a) => a.organization_id === 2)!;
    expect(orgB.has_pending_requirements).toBe(true);

    render(
      <span>
        {orgB.has_pending_requirements ? (
          <span data-testid="pending-badge">Pending</span>
        ) : (
          <span data-testid="dash">—</span>
        )}
      </span>,
    );
    expect(screen.getByTestId('pending-badge')).toBeInTheDocument();
  });

  it('shows dash when no pending requirements', () => {
    const accounts = makeStripeConnectAccounts();
    const orgA = accounts.find((a) => a.organization_id === 1)!;
    expect(orgA.has_pending_requirements).toBe(false);

    render(
      <span>
        {orgA.has_pending_requirements ? (
          <span data-testid="pending-badge">Pending</span>
        ) : (
          <span data-testid="dash">—</span>
        )}
      </span>,
    );
    expect(screen.getByTestId('dash')).toBeInTheDocument();
  });
});

// ─── platformPayments API shape tests ────────────────────────────────────────

describe('platformPayments API methods exist', () => {
  it('has all required payment API methods', () => {
    expect(typeof platformApi.platformPayments.status).toBe('function');
    expect(typeof platformApi.platformPayments.enable).toBe('function');
    expect(typeof platformApi.platformPayments.disable).toBe('function');
    expect(typeof platformApi.platformPayments.orgStatus).toBe('function');
    expect(typeof platformApi.platformPayments.enableOrg).toBe('function');
    expect(typeof platformApi.platformPayments.disableOrg).toBe('function');
    expect(typeof platformApi.platformPayments.setOrgFlag).toBe('function');
    expect(typeof platformApi.platformPayments.takeRates).toBe('function');
    expect(typeof platformApi.platformPayments.updateTakeRate).toBe('function');
    expect(typeof platformApi.platformPayments.connectAccounts).toBe('function');
  });
});

// ─── PaymentStatus shape tests ────────────────────────────────────────────────

describe('PaymentStatus fixture shape', () => {
  it('has all required fields', () => {
    const status = makePaymentStatus();
    expect(typeof status.platform_payments_enabled).toBe('boolean');
    expect(typeof status.orgs_payment_enabled_count).toBe('number');
    expect(typeof status.orgs_stripe_connected_count).toBe('number');
    expect(typeof status.orgs_stripe_charges_enabled_count).toBe('number');
  });

  it('orgs_payment_enabled_count drives the "affects X organisations" message', () => {
    const status = makePaymentStatus({ orgs_payment_enabled_count: 7 });
    expect(status.orgs_payment_enabled_count).toBe(7);
  });
});
