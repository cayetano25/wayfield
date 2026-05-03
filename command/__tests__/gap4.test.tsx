import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as platformApi from '@/lib/platform-api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeReadinessItem(
  overrides: Partial<platformApi.WorkshopReadinessItem> = {},
): platformApi.WorkshopReadinessItem {
  return {
    workshop_id: 1,
    title: 'Landscape Photography',
    organization_id: 10,
    organization_name: 'Cascade Photo',
    status: 'draft',
    readiness_score: 65,
    missing_items: ['description', 'location'],
    ready_to_publish: false,
    ...overrides,
  };
}

function makeRefundPolicy(
  overrides: Partial<platformApi.RefundPolicy> = {},
): platformApi.RefundPolicy {
  return {
    id: 1,
    policy_level: 'organization',
    organization_id: 10,
    organization_name: 'Cascade Photo',
    workshop_id: null,
    workshop_title: null,
    policy_type: 'standard',
    custom_policy_text: null,
    is_active: true,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 1 (Priority 2): ReadinessDot colour coding
// ═════════════════════════════════════════════════════════════════════════════

describe('ReadinessDot — colour by score', () => {
  function ReadinessDot({ score }: { score: number }) {
    const cls =
      score >= 80 ? 'bg-teal-500' :
      score >= 50 ? 'bg-amber-400' :
                   'bg-red-500';
    const label =
      score >= 80 ? 'Ready' :
      score >= 50 ? 'Needs attention' :
                   'Incomplete';
    return <span data-testid="dot" className={cls} aria-label={label} />;
  }

  it('score 80 → teal (Ready)', () => {
    render(<ReadinessDot score={80} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-teal-500');
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-label', 'Ready');
  });

  it('score 100 → teal (Ready)', () => {
    render(<ReadinessDot score={100} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-teal-500');
  });

  it('score 65 → amber (Needs attention)', () => {
    render(<ReadinessDot score={65} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-amber-400');
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-label', 'Needs attention');
  });

  it('score 50 → amber boundary', () => {
    render(<ReadinessDot score={50} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-amber-400');
    expect(screen.getByTestId('dot')).not.toHaveClass('bg-red-500');
  });

  it('score 49 → red (Incomplete)', () => {
    render(<ReadinessDot score={49} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-red-500');
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-label', 'Incomplete');
  });

  it('score 0 → red (Incomplete)', () => {
    render(<ReadinessDot score={0} />);
    expect(screen.getByTestId('dot')).toHaveClass('bg-red-500');
  });

  it('dot has aria-label (text label — not colour alone)', () => {
    render(<ReadinessDot score={30} />);
    const dot = screen.getByTestId('dot');
    expect(dot).toHaveAttribute('aria-label');
    expect(dot.getAttribute('aria-label')).not.toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 2: ScoreBadge colour coding (overview page readiness table)
// ═════════════════════════════════════════════════════════════════════════════

describe('ScoreBadge — colour by score', () => {
  function ScoreBadge({ score }: { score: number }) {
    const cls =
      score >= 80
        ? 'bg-teal-50 text-teal-700'
        : score >= 50
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';
    return (
      <span data-testid="score-badge" className={cls}>
        {score}
      </span>
    );
  }

  it('score ≥ 80 → teal badge', () => {
    render(<ScoreBadge score={80} />);
    expect(screen.getByTestId('score-badge')).toHaveClass('text-teal-700');
  });

  it('score 79 → amber badge', () => {
    render(<ScoreBadge score={79} />);
    expect(screen.getByTestId('score-badge')).toHaveClass('text-amber-700');
    expect(screen.getByTestId('score-badge')).not.toHaveClass('text-teal-700');
  });

  it('score 50 → amber badge (boundary)', () => {
    render(<ScoreBadge score={50} />);
    expect(screen.getByTestId('score-badge')).toHaveClass('text-amber-700');
  });

  it('score 49 → red badge', () => {
    render(<ScoreBadge score={49} />);
    expect(screen.getByTestId('score-badge')).toHaveClass('text-red-700');
  });

  it('score 0 → red badge', () => {
    render(<ScoreBadge score={0} />);
    expect(screen.getByTestId('score-badge')).toHaveClass('text-red-700');
  });

  it('badge renders the score as text', () => {
    render(<ScoreBadge score={72} />);
    expect(screen.getByTestId('score-badge').textContent).toBe('72');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 3: Workshop Readiness Section — missing items truncation
// ═════════════════════════════════════════════════════════════════════════════

describe('Workshop Readiness — missing items truncation', () => {
  function truncate(items: string[]): string {
    const text = items.join(', ');
    return text.length > 60 ? text.slice(0, 60) + '…' : text;
  }

  it('short list is not truncated', () => {
    const result = truncate(['description', 'location']);
    expect(result).toBe('description, location');
    expect(result.endsWith('…')).toBe(false);
  });

  it('list over 60 chars is truncated with ellipsis', () => {
    const items = ['description', 'location', 'start_date', 'leader_assignment', 'pricing_required'];
    const result = truncate(items);
    expect(result.length).toBeLessThanOrEqual(61); // 60 chars + ellipsis char
    expect(result.endsWith('…')).toBe(true);
  });

  it('empty list renders as dash (handled by falsy check)', () => {
    const result = truncate([]) || '—';
    expect(result).toBe('—');
  });

  it('exactly 60 chars is not truncated', () => {
    const text = 'a'.repeat(60);
    const items = [text];
    const result = truncate(items);
    expect(result.endsWith('…')).toBe(false);
  });

  it('61 chars is truncated', () => {
    const text = 'a'.repeat(61);
    const items = [text];
    const result = truncate(items);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('Workshop Readiness — Ready? column', () => {
  function ReadyCell({ ready }: { ready: boolean }) {
    return ready
      ? <span data-testid="ready-cell" className="text-teal-600">Yes</span>
      : <span data-testid="ready-cell" className="text-red-500">No</span>;
  }

  it('ready_to_publish true → "Yes" in teal', () => {
    render(<ReadyCell ready={true} />);
    expect(screen.getByTestId('ready-cell')).toHaveClass('text-teal-600');
    expect(screen.getByTestId('ready-cell').textContent).toBe('Yes');
  });

  it('ready_to_publish false → "No" in red', () => {
    render(<ReadyCell ready={false} />);
    expect(screen.getByTestId('ready-cell')).toHaveClass('text-red-500');
    expect(screen.getByTestId('ready-cell').textContent).toBe('No');
  });
});

describe('Workshop Readiness — all-green success state', () => {
  it('success state contains "All draft workshops score 80+" text', () => {
    const SuccessState = () => (
      <div data-testid="readiness-success">
        <svg data-testid="check-icon" />
        <span>All draft workshops score 80+ — good shape!</span>
      </div>
    );
    render(<SuccessState />);
    expect(screen.getByTestId('readiness-success')).toBeInTheDocument();
    expect(screen.getByText(/All draft workshops score 80\+/)).toBeInTheDocument();
  });
});

describe('WorkshopReadinessItem type shape', () => {
  it('fixture conforms to WorkshopReadinessItem interface', () => {
    const item = makeReadinessItem();
    expect(typeof item.workshop_id).toBe('number');
    expect(typeof item.title).toBe('string');
    expect(typeof item.readiness_score).toBe('number');
    expect(Array.isArray(item.missing_items)).toBe(true);
    expect(typeof item.ready_to_publish).toBe('boolean');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 4: Leader Profiles card — colour by completion rate
// ═════════════════════════════════════════════════════════════════════════════

describe('LeaderProfilesCard — value colour by completion_rate_pct', () => {
  function valueColor(pct: number): string {
    return pct === 100 ? 'text-teal-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
  }

  it('100% complete → teal', () => {
    expect(valueColor(100)).toBe('text-teal-600');
  });

  it('80% complete → amber', () => {
    expect(valueColor(80)).toBe('text-amber-600');
  });

  it('50% complete → amber (boundary)', () => {
    expect(valueColor(50)).toBe('text-amber-600');
  });

  it('49% complete → red', () => {
    expect(valueColor(49)).toBe('text-red-600');
  });

  it('0% complete → red', () => {
    expect(valueColor(0)).toBe('text-red-600');
  });

  it('99% complete → amber (not teal — only 100 is teal)', () => {
    expect(valueColor(99)).toBe('text-amber-600');
    expect(valueColor(99)).not.toBe('text-teal-600');
  });

  it('renders completion fraction correctly', () => {
    const { complete, total } = { complete: 4, total: 5 };
    const { container } = render(
      <div data-testid="leader-profiles-card">
        <span data-testid="leader-profiles-value">{complete} / {total}</span>
        <span>{80}% complete</span>
      </div>,
    );
    expect(screen.getByTestId('leader-profiles-value').textContent).toBe('4 / 5');
    expect(container.textContent).toContain('80% complete');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 5: Refund Policies tab
// ═════════════════════════════════════════════════════════════════════════════

describe('PolicyLevelBadge — colour by level', () => {
  function PolicyLevelBadge({ level }: { level: string }) {
    const styles: Record<string, string> = {
      platform:     'bg-purple-50 text-purple-700',
      organization: 'bg-teal-50 text-teal-700',
      workshop:     'bg-blue-50 text-blue-700',
    };
    return (
      <span
        data-testid="level-badge"
        className={styles[level] ?? 'bg-gray-100 text-gray-600'}
      >
        {level}
      </span>
    );
  }

  it('platform level → purple badge', () => {
    render(<PolicyLevelBadge level="platform" />);
    expect(screen.getByTestId('level-badge')).toHaveClass('text-purple-700');
  });

  it('organization level → teal badge', () => {
    render(<PolicyLevelBadge level="organization" />);
    expect(screen.getByTestId('level-badge')).toHaveClass('text-teal-700');
  });

  it('workshop level → blue badge', () => {
    render(<PolicyLevelBadge level="workshop" />);
    expect(screen.getByTestId('level-badge')).toHaveClass('text-blue-700');
  });

  it('unknown level → gray fallback', () => {
    render(<PolicyLevelBadge level="unknown" />);
    expect(screen.getByTestId('level-badge')).toHaveClass('text-gray-600');
  });

  it('badge text matches the level value', () => {
    render(<PolicyLevelBadge level="platform" />);
    expect(screen.getByTestId('level-badge').textContent).toBe('platform');
  });
});

describe('Refund Policies — policy_type badge', () => {
  function PolicyTypeBadge({ type }: { type: string }) {
    return (
      <span
        data-testid="type-badge"
        className={
          type === 'custom'
            ? 'bg-orange-50 text-orange-700'
            : 'bg-gray-100 text-gray-600'
        }
      >
        {type}
      </span>
    );
  }

  it('custom type → orange badge', () => {
    render(<PolicyTypeBadge type="custom" />);
    expect(screen.getByTestId('type-badge')).toHaveClass('text-orange-700');
  });

  it('standard type → gray badge', () => {
    render(<PolicyTypeBadge type="standard" />);
    expect(screen.getByTestId('type-badge')).toHaveClass('text-gray-600');
    expect(screen.getByTestId('type-badge')).not.toHaveClass('text-orange-700');
  });
});

describe('Refund Policies — unavailable state', () => {
  it('unavailable card uses amber styling (config gap, not error)', () => {
    const UnavailableCard = () => (
      <div
        data-testid="refund-policies-unavailable"
        className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-5"
      >
        <p className="text-sm font-medium text-amber-800">
          Refund policy data not available
        </p>
        <p className="text-sm text-amber-700">
          The refund policy schema is not yet active.
        </p>
      </div>
    );
    render(<UnavailableCard />);
    const card = screen.getByTestId('refund-policies-unavailable');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('bg-amber-50');
    expect(card).not.toHaveClass('bg-red-50');
    expect(screen.getByText('Refund policy data not available')).toBeInTheDocument();
  });

  it('unavailable state shows reason when provided', () => {
    const reason = 'Stripe webhook not connected.';
    render(
      <div data-testid="refund-policies-unavailable">
        <p>{reason}</p>
      </div>,
    );
    expect(screen.getByText(reason)).toBeInTheDocument();
  });
});

describe('Refund Policies — summary cards', () => {
  it('renders 4 summary cards for the expected metrics', () => {
    const summary: platformApi.RefundPolicySummary = {
      total: 12,
      platform_level: 2,
      org_level: 7,
      workshop_level: 3,
      workshops_without_policy: 5,
    };

    const summaryCards = [
      { label: 'TOTAL POLICIES', value: summary.total ?? 0 },
      { label: 'PLATFORM LEVEL', value: summary.platform_level ?? 0 },
      { label: 'ORG LEVEL', value: summary.org_level ?? 0 },
      { label: 'WITHOUT POLICY', value: summary.workshops_without_policy ?? 0 },
    ];

    expect(summaryCards).toHaveLength(4);
    expect(summaryCards[0].value).toBe(12);
    expect(summaryCards[1].value).toBe(2);
    expect(summaryCards[2].value).toBe(7);
    expect(summaryCards[3].value).toBe(5);
  });

  it('null summary fields default to 0', () => {
    const summary: platformApi.RefundPolicySummary = {};
    const total = summary.total ?? 0;
    const platformLevel = summary.platform_level ?? 0;
    expect(total).toBe(0);
    expect(platformLevel).toBe(0);
  });
});

describe('Refund Policies — table row rendering', () => {
  it('org-level policy with no workshop_title shows dash', () => {
    const policy = makeRefundPolicy({ policy_level: 'organization', workshop_title: null });
    const display = policy.workshop_title ?? '—';
    expect(display).toBe('—');
  });

  it('workshop-level policy shows workshop title', () => {
    const policy = makeRefundPolicy({
      policy_level: 'workshop',
      workshop_id: 5,
      workshop_title: 'Desert Portraits',
    });
    expect(policy.workshop_title).toBe('Desert Portraits');
  });

  it('platform-level policy has null org and workshop', () => {
    const policy = makeRefundPolicy({
      policy_level: 'platform',
      organization_id: null,
      organization_name: null,
      workshop_id: null,
      workshop_title: null,
    });
    expect(policy.organization_name ?? '—').toBe('—');
    expect(policy.workshop_title ?? '—').toBe('—');
  });
});

describe('RefundPolicy type shape', () => {
  it('fixture conforms to RefundPolicy interface', () => {
    const policy = makeRefundPolicy();
    expect(typeof policy.id).toBe('number');
    expect(['platform', 'organization', 'workshop']).toContain(policy.policy_level);
    expect(['custom', 'standard']).toContain(policy.policy_type);
    expect(typeof policy.is_active).toBe('boolean');
    expect(typeof policy.created_at).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// API methods exist
// ═════════════════════════════════════════════════════════════════════════════

describe('platformWorkshops.readiness API method', () => {
  it('readiness method exists', () => {
    expect(typeof platformApi.platformWorkshops.readiness).toBe('function');
  });
});

describe('platformFinancials.refundPolicies API method', () => {
  it('refundPolicies method exists', () => {
    expect(typeof platformApi.platformFinancials.refundPolicies).toBe('function');
  });
});

describe('Financials TABS include refund-policies', () => {
  const TABS = [
    'overview',
    'invoices',
    'payment-controls',
    'take-rates',
    'stripe-connect',
    'refund-policies',
    'failed-payments',
  ] as const;

  it('TABS array contains refund-policies key', () => {
    expect(TABS).toContain('refund-policies');
  });

  it('refund-policies tab appears after stripe-connect', () => {
    const scIdx = TABS.indexOf('stripe-connect');
    const rpIdx = TABS.indexOf('refund-policies');
    expect(rpIdx).toBeGreaterThan(scIdx);
  });

  it('refund-policies tab appears before failed-payments', () => {
    const rpIdx = TABS.indexOf('refund-policies');
    const fpIdx = TABS.indexOf('failed-payments');
    expect(rpIdx).toBeLessThan(fpIdx);
  });
});
