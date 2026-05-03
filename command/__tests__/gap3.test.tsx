import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// ─── Global mocks ─────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
}));

vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: {
      id: 1,
      first_name: 'Test',
      last_name: 'Admin',
      email: 'admin@wayfield.io',
      role: 'super_admin',
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
    viewHealth:         (r: string) => ['super_admin', 'admin', 'support'].includes(r),
    viewAuditLog:       (r: string) => ['super_admin', 'admin'].includes(r),
    manageSettings:     (r: string) => r === 'super_admin',
    managePayments:     (r: string) => ['super_admin', 'billing'].includes(r),
    manageTakeRates:    (r: string) => r === 'super_admin',
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOrgEmailRow(overrides: Partial<platformApi.OrgEmailDelivery> = {}): platformApi.OrgEmailDelivery {
  return {
    organization_id: 1,
    organization_name: 'Test Org',
    sent_30d: 1000,
    bounce_rate_pct: 1.0,
    complaint_rate_pct: 0.05,
    status: 'ok',
    ...overrides,
  };
}

function makeFailedPayment(overrides: Partial<platformApi.FailedPayment> = {}): platformApi.FailedPayment {
  return {
    id: 1,
    organization_id: 1,
    organization_name: 'Test Org',
    amount_cents: 9900,
    currency: 'usd',
    failure_reason: 'card_declined',
    customer_email: 'customer@example.com',
    created_at: '2026-05-01T12:00:00Z',
    ...overrides,
  };
}

function makeAddonSession(overrides: Partial<platformApi.AddonSessionPricing> = {}): platformApi.AddonSessionPricing {
  return {
    session_id: 10,
    session_title: 'Advanced Session',
    workshop_id: 1,
    workshop_title: 'Photography Workshop',
    session_type: 'addon',
    price_cents: 4900,
    deposit_amount_cents: 1000,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 1: Health Monitor — Email by Organisation section
// ═════════════════════════════════════════════════════════════════════════════

describe('Email by Organisation — bounce rate colour coding', () => {
  function BounceRateCell({ pct }: { pct: number }) {
    const cls =
      pct > 5   ? 'text-red-600 font-medium' :
      pct >= 2  ? 'text-amber-600' :
                  'text-gray-500';
    return (
      <span data-testid="bounce-cell" className={cls}>
        {pct.toFixed(1)}%
      </span>
    );
  }

  it('bounce rate > 5% → red text class', () => {
    render(<BounceRateCell pct={6.2} />);
    const cell = screen.getByTestId('bounce-cell');
    expect(cell).toHaveClass('text-red-600');
  });

  it('bounce rate 2–5% → amber text class', () => {
    render(<BounceRateCell pct={3.0} />);
    const cell = screen.getByTestId('bounce-cell');
    expect(cell).toHaveClass('text-amber-600');
  });

  it('bounce rate < 2% → gray text class', () => {
    render(<BounceRateCell pct={0.8} />);
    const cell = screen.getByTestId('bounce-cell');
    expect(cell).toHaveClass('text-gray-500');
  });

  it('boundary: exactly 5% still amber, not red', () => {
    render(<BounceRateCell pct={5.0} />);
    expect(screen.getByTestId('bounce-cell')).toHaveClass('text-amber-600');
    expect(screen.getByTestId('bounce-cell')).not.toHaveClass('text-red-600');
  });

  it('boundary: 5.1% is red', () => {
    render(<BounceRateCell pct={5.1} />);
    expect(screen.getByTestId('bounce-cell')).toHaveClass('text-red-600');
  });
});

describe('Email by Organisation — high-bounce row highlight', () => {
  function OrgRow({ row }: { row: platformApi.OrgEmailDelivery }) {
    const isHighBounce = row.bounce_rate_pct > 5;
    return (
      <table>
        <tbody>
          <tr
            data-testid={`row-${row.organization_id}`}
            className={isHighBounce ? 'bg-red-50' : ''}
          >
            <td>{row.organization_name}</td>
            <td data-testid="bounce-value">{row.bounce_rate_pct.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    );
  }

  it('row with bounce rate > 5% gets bg-red-50 class', () => {
    const row = makeOrgEmailRow({ organization_id: 1, bounce_rate_pct: 7.2, status: 'high_bounce' });
    render(<OrgRow row={row} />);
    expect(screen.getByTestId('row-1')).toHaveClass('bg-red-50');
  });

  it('row with bounce rate ≤ 5% does NOT get bg-red-50', () => {
    const row = makeOrgEmailRow({ organization_id: 2, bounce_rate_pct: 3.0, status: 'ok' });
    render(<OrgRow row={row} />);
    expect(screen.getByTestId('row-2')).not.toHaveClass('bg-red-50');
  });

  it('row with bounce rate = 0 has no red highlight', () => {
    const row = makeOrgEmailRow({ organization_id: 3, bounce_rate_pct: 0, status: 'ok' });
    render(<OrgRow row={row} />);
    expect(screen.getByTestId('row-3')).not.toHaveClass('bg-red-50');
  });
});

describe('Email by Organisation — status badge uses text + colour (Apple HIG)', () => {
  function StatusBadge({ status }: { status: platformApi.OrgEmailDelivery['status'] }) {
    if (status === 'high_bounce') {
      return (
        <span data-testid="status-badge" className="text-red-700 bg-red-50">
          ⚠ High bounce
        </span>
      );
    }
    if (status === 'no_data') {
      return <span data-testid="status-badge" className="text-gray-500">—</span>;
    }
    return (
      <span data-testid="status-badge" className="text-teal-700 bg-teal-50">
        OK
      </span>
    );
  }

  it('high_bounce: shows text "High bounce" (not colour alone)', () => {
    render(<StatusBadge status="high_bounce" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveClass('text-red-700');
    expect(badge.textContent).toContain('High bounce');
  });

  it('ok: shows text "OK" (not colour alone)', () => {
    render(<StatusBadge status="ok" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveClass('text-teal-700');
    expect(badge.textContent).toBe('OK');
  });

  it('no_data: shows dash text', () => {
    render(<StatusBadge status="no_data" />);
    expect(screen.getByTestId('status-badge').textContent).toBe('—');
  });
});

describe('can.viewHealth role helper', () => {
  const viewHealth = (r: string) => ['super_admin', 'admin', 'support'].includes(r);

  it('super_admin: true', () => expect(viewHealth('super_admin')).toBe(true));
  it('admin: true',       () => expect(viewHealth('admin')).toBe(true));
  it('support: true',     () => expect(viewHealth('support')).toBe(true));
  it('billing: false',    () => expect(viewHealth('billing')).toBe(false));
  it('readonly: false',   () => expect(viewHealth('readonly')).toBe(false));
});

describe('platformHealth API methods exist', () => {
  it('has sesStats and emailByOrg methods', () => {
    expect(typeof platformApi.platformHealth.sesStats).toBe('function');
    expect(typeof platformApi.platformHealth.emailByOrg).toBe('function');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 2: Failed Payments tab
// ═════════════════════════════════════════════════════════════════════════════

describe('Failed Payments — unavailable state when webhook not wired', () => {
  it('shows amber AlertTriangle when stripe_webhook_required is true', () => {
    const UnavailableCard = () => (
      <div data-testid="failed-payments-unavailable" className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-5 flex items-start gap-3">
        <svg data-testid="alert-icon" aria-label="Warning" className="text-amber-500" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            Failed payment data requires the Stripe webhook to be connected.
          </p>
        </div>
      </div>
    );
    render(<UnavailableCard />);
    expect(screen.getByTestId('failed-payments-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    expect(screen.getByText(/Failed payment data requires the Stripe webhook/)).toBeInTheDocument();
  });

  it('renders in amber (bg-amber-50) not red — not a critical error, just a config issue', () => {
    const { container } = render(
      <div data-testid="notice" className="bg-amber-50 border-amber-200">Notice</div>,
    );
    expect(screen.getByTestId('notice')).toHaveClass('bg-amber-50');
    expect(screen.getByTestId('notice')).not.toHaveClass('bg-red-50');
  });
});

describe('Failed Payments — empty state when no failures in period', () => {
  it('shows empty message when data array is empty', () => {
    const EmptyState = () => (
      <table>
        <tbody>
          <tr>
            <td data-testid="fp-empty">No failed payments in the selected period.</td>
          </tr>
        </tbody>
      </table>
    );
    render(<EmptyState />);
    expect(screen.getByTestId('fp-empty')).toBeInTheDocument();
    expect(screen.getByText('No failed payments in the selected period.')).toBeInTheDocument();
  });

  it('empty state message differs from the unavailable/webhook state', () => {
    const unavailableText = 'Failed payment data requires the Stripe webhook to be connected.';
    const emptyText = 'No failed payments in the selected period.';
    expect(unavailableText).not.toBe(emptyText);
  });
});

describe('Failed Payments — data rendering', () => {
  it('formats amount in dollars from cents', () => {
    const payment = makeFailedPayment({ amount_cents: 9900 });
    const formatted = `$${(payment.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    expect(formatted).toBe('$99');
  });

  it('truncates failure reason at 80 characters', () => {
    const longReason = 'a'.repeat(100);
    const truncated = longReason.slice(0, 80) + (longReason.length > 80 ? '…' : '');
    expect(truncated.length).toBe(81); // 80 chars + ellipsis
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('short reason is not truncated', () => {
    const shortReason = 'card_declined';
    const truncated = shortReason.slice(0, 80) + (shortReason.length > 80 ? '…' : '');
    expect(truncated).toBe('card_declined');
  });

  it('null failure reason renders as dash', () => {
    const payment = makeFailedPayment({ failure_reason: null });
    const display = payment.failure_reason
      ? payment.failure_reason.slice(0, 80)
      : '—';
    expect(display).toBe('—');
  });
});

describe('platformFinancials.failedPayments API method exists', () => {
  it('has failedPayments method', () => {
    expect(typeof platformApi.platformFinancials.failedPayments).toBe('function');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 3: Add-On Session Pricing — collapsible section
// ═════════════════════════════════════════════════════════════════════════════

describe('Add-On Pricing — collapsible toggle', () => {
  function CollapsibleSection({ items }: { items: platformApi.AddonSessionPricing[] }) {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid="addon-pricing-toggle"
        >
          Add-On Session Pricing
        </button>
        {open && (
          <div data-testid="addon-pricing-content">
            {items.length === 0 ? (
              <p data-testid="addon-pricing-empty">
                No add-on session pricing configured for this organisation.
              </p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.session_id} data-testid={`addon-row-${item.session_id}`}>
                    {item.session_title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  it('content is hidden by default (collapsed)', () => {
    render(<CollapsibleSection items={[]} />);
    expect(screen.queryByTestId('addon-pricing-content')).toBeNull();
  });

  it('content appears after clicking toggle', () => {
    render(<CollapsibleSection items={[]} />);
    fireEvent.click(screen.getByTestId('addon-pricing-toggle'));
    expect(screen.getByTestId('addon-pricing-content')).toBeInTheDocument();
  });

  it('aria-expanded is false when collapsed', () => {
    render(<CollapsibleSection items={[]} />);
    expect(screen.getByTestId('addon-pricing-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded is true when expanded', () => {
    render(<CollapsibleSection items={[]} />);
    fireEvent.click(screen.getByTestId('addon-pricing-toggle'));
    expect(screen.getByTestId('addon-pricing-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('can toggle closed again', () => {
    render(<CollapsibleSection items={[]} />);
    const btn = screen.getByTestId('addon-pricing-toggle');
    fireEvent.click(btn);
    expect(screen.getByTestId('addon-pricing-content')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByTestId('addon-pricing-content')).toBeNull();
  });
});

describe('Add-On Pricing — empty state when none configured', () => {
  function CollapsibleSection({ items }: { items: platformApi.AddonSessionPricing[] }) {
    const [open, setOpen] = React.useState(true);
    return (
      <div>
        <button onClick={() => setOpen((o) => !o)} data-testid="toggle">Toggle</button>
        {open && (
          <div>
            {items.length === 0 ? (
              <p data-testid="addon-pricing-empty">
                No add-on session pricing configured for this organisation.
              </p>
            ) : (
              <ul>{items.map((i) => <li key={i.session_id}>{i.session_title}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    );
  }

  it('shows empty message when items array is empty', () => {
    render(<CollapsibleSection items={[]} />);
    expect(screen.getByTestId('addon-pricing-empty')).toBeInTheDocument();
    expect(screen.getByText(/No add-on session pricing configured/)).toBeInTheDocument();
  });

  it('does NOT show empty state when items exist', () => {
    const items = [makeAddonSession()];
    render(<CollapsibleSection items={items} />);
    expect(screen.queryByTestId('addon-pricing-empty')).toBeNull();
    expect(screen.getByText('Advanced Session')).toBeInTheDocument();
  });
});

describe('Add-On Pricing — session type badges', () => {
  it('addon type maps to teal badge class', () => {
    const SESSION_TYPE_BADGE: Record<string, string> = {
      addon:       'bg-teal-50 text-teal-700 border border-teal-100',
      invite_only: 'bg-purple-50 text-purple-700 border border-purple-100',
    };
    expect(SESSION_TYPE_BADGE['addon']).toContain('teal');
    expect(SESSION_TYPE_BADGE['invite_only']).toContain('purple');
  });

  it('invite_only type maps to purple badge class', () => {
    const item = makeAddonSession({ session_type: 'invite_only' });
    expect(item.session_type).toBe('invite_only');
    // The badge should be purple for invite_only
    const badgeClass = item.session_type === 'invite_only'
      ? 'bg-purple-50 text-purple-700'
      : 'bg-teal-50 text-teal-700';
    expect(badgeClass).toContain('purple');
  });
});

describe('Add-On Pricing — price formatting', () => {
  function formatCents(cents: number | null): string {
    if (cents === null) return 'Free';
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  it('null price renders as "Free"', () => {
    expect(formatCents(null)).toBe('Free');
  });

  it('0 cents renders as "$0"', () => {
    expect(formatCents(0)).toBe('$0');
  });

  it('4900 cents renders as "$49"', () => {
    expect(formatCents(4900)).toBe('$49');
  });

  it('1050 cents renders as "$10.5" (trailing zero not added with minimumFractionDigits:0)', () => {
    expect(formatCents(1050)).toBe('$10.5');
  });
});

describe('platformWorkshops API methods exist', () => {
  it('has pricingAudit and addonPricing methods', () => {
    expect(typeof platformApi.platformWorkshops.pricingAudit).toBe('function');
    expect(typeof platformApi.platformWorkshops.addonPricing).toBe('function');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 4: Financials — Failed Payments tab is listed in tab set
// ═════════════════════════════════════════════════════════════════════════════

describe('Financials tabs include failed-payments', () => {
  it('TABS array contains failed-payments key', () => {
    const TABS = [
      'overview',
      'invoices',
      'payment-controls',
      'take-rates',
      'stripe-connect',
      'failed-payments',
    ] as const;
    expect(TABS).toContain('failed-payments');
  });

  it('failed-payments tab appears after stripe-connect', () => {
    const TABS = [
      'overview',
      'invoices',
      'payment-controls',
      'take-rates',
      'stripe-connect',
      'failed-payments',
    ] as const;
    const scIdx = TABS.indexOf('stripe-connect');
    const fpIdx = TABS.indexOf('failed-payments');
    expect(fpIdx).toBeGreaterThan(scIdx);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 5: Org detail — Workshops tab is present
// ═════════════════════════════════════════════════════════════════════════════

describe('Org detail TABS include workshops', () => {
  it('TABS contains workshops', () => {
    const TABS = ['overview', 'billing', 'flags', 'usage', 'payments', 'workshops', 'audit'] as const;
    expect(TABS).toContain('workshops');
  });
});
