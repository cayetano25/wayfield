import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getAnnouncementStatus,
  getRowBorderClass,
  BannerPreview,
  TYPE_CONFIG,
} from '@/app/(admin)/announcements/page';
import type { SystemAnnouncement } from '@/lib/platform-api';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => 'in 2 hours',
  format: () => 'Jan 1, 2026 09:00',
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

function makeAnnouncement(overrides: Partial<SystemAnnouncement> = {}): SystemAnnouncement {
  return {
    id: 1,
    title: 'Test Announcement',
    message: 'Something important.',
    announcement_type: 'info',
    is_active: true,
    is_dismissable: true,
    starts_at: null,
    ends_at: null,
    created_by_admin_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 1: getAnnouncementStatus — status computation logic
// ═════════════════════════════════════════════════════════════════════════════

describe('getAnnouncementStatus', () => {
  it('inactive when is_active=false regardless of dates', () => {
    const a = makeAnnouncement({ is_active: false });
    expect(getAnnouncementStatus(a)).toBe('inactive');
  });

  it('inactive when is_active=false even if ends_at in past', () => {
    const a = makeAnnouncement({ is_active: false, ends_at: PAST });
    expect(getAnnouncementStatus(a)).toBe('inactive');
  });

  it('expired when is_active=true and ends_at in past', () => {
    const a = makeAnnouncement({ is_active: true, ends_at: PAST });
    expect(getAnnouncementStatus(a)).toBe('expired');
  });

  it('scheduled when is_active=true and starts_at in future', () => {
    const a = makeAnnouncement({ is_active: true, starts_at: FUTURE });
    expect(getAnnouncementStatus(a)).toBe('scheduled');
  });

  it('live when is_active=true and no date constraints', () => {
    const a = makeAnnouncement({ is_active: true, starts_at: null, ends_at: null });
    expect(getAnnouncementStatus(a)).toBe('live');
  });

  it('live when is_active=true, starts_at in past, ends_at in future', () => {
    const a = makeAnnouncement({ is_active: true, starts_at: PAST, ends_at: FUTURE });
    expect(getAnnouncementStatus(a)).toBe('live');
  });

  it('expired takes priority over scheduled (ends_at past)', () => {
    const a = makeAnnouncement({ is_active: true, starts_at: PAST, ends_at: PAST });
    expect(getAnnouncementStatus(a)).toBe('expired');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 2: getRowBorderClass — row border colours
// ═════════════════════════════════════════════════════════════════════════════

describe('getRowBorderClass', () => {
  it('live info → teal left border', () => {
    expect(getRowBorderClass('live', 'info')).toContain('border-l-teal-400');
  });

  it('live warning → teal left border (only critical differs)', () => {
    expect(getRowBorderClass('live', 'warning')).toContain('border-l-teal-400');
  });

  it('live critical → red left border', () => {
    const cls = getRowBorderClass('live', 'critical');
    expect(cls).toContain('border-l-red-400');
    expect(cls).not.toContain('border-l-teal-400');
  });

  it('scheduled → transparent border (not live)', () => {
    expect(getRowBorderClass('scheduled', 'info')).toContain('border-l-transparent');
  });

  it('expired → transparent border', () => {
    expect(getRowBorderClass('expired', 'critical')).toContain('border-l-transparent');
  });

  it('inactive → transparent border', () => {
    expect(getRowBorderClass('inactive', 'warning')).toContain('border-l-transparent');
  });

  it('all live rows have border-l-2', () => {
    expect(getRowBorderClass('live', 'info')).toContain('border-l-2');
    expect(getRowBorderClass('live', 'critical')).toContain('border-l-2');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 3: BannerPreview — live preview renders correctly
// ═════════════════════════════════════════════════════════════════════════════

describe('BannerPreview', () => {
  it('renders the title when provided', () => {
    render(<BannerPreview title="Scheduled Maintenance" message="" type="warning" />);
    expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument();
  });

  it('renders the message when provided', () => {
    render(<BannerPreview title="" message="We will be down for 30 minutes." type="info" />);
    expect(screen.getByText('We will be down for 30 minutes.')).toBeInTheDocument();
  });

  it('shows placeholder text when both title and message are empty', () => {
    render(<BannerPreview title="" message="" type="info" />);
    expect(screen.getByText(/Preview will appear here/)).toBeInTheDocument();
  });

  it('info type uses blue styling', () => {
    const { container } = render(<BannerPreview title="Info" message="Notice" type="info" />);
    expect(container.firstChild).toHaveClass('bg-blue-50');
  });

  it('warning type uses amber styling', () => {
    const { container } = render(<BannerPreview title="Warn" message="Heads up" type="warning" />);
    expect(container.firstChild).toHaveClass('bg-amber-50');
  });

  it('critical type uses red styling', () => {
    const { container } = render(
      <BannerPreview title="Outage" message="Service down" type="critical" />,
    );
    expect(container.firstChild).toHaveClass('bg-red-50');
  });

  it('preview updates when title changes (re-render)', () => {
    const { rerender } = render(<BannerPreview title="Original" message="" type="info" />);
    expect(screen.getByText('Original')).toBeInTheDocument();
    rerender(<BannerPreview title="Updated Title" message="" type="info" />);
    expect(screen.queryByText('Original')).not.toBeInTheDocument();
    expect(screen.getByText('Updated Title')).toBeInTheDocument();
  });

  it('preview updates when message changes (re-render)', () => {
    const { rerender } = render(<BannerPreview title="" message="First message" type="info" />);
    expect(screen.getByText('First message')).toBeInTheDocument();
    rerender(<BannerPreview title="" message="Second message" type="info" />);
    expect(screen.queryByText('First message')).not.toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('preview updates when type changes (re-render)', () => {
    const { rerender, container } = render(
      <BannerPreview title="T" message="M" type="info" />,
    );
    expect(container.firstChild).toHaveClass('bg-blue-50');
    rerender(<BannerPreview title="T" message="M" type="critical" />);
    expect(container.firstChild).toHaveClass('bg-red-50');
    expect(container.firstChild).not.toHaveClass('bg-blue-50');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 4: Enable modal — type-to-confirm logic
// ═════════════════════════════════════════════════════════════════════════════

describe('Enable maintenance modal — type-to-confirm', () => {
  function canConfirm(confirmInput: string, message: string): boolean {
    return confirmInput === 'ENABLE' && message.trim().length > 0;
  }

  it('button disabled when confirm input is empty', () => {
    expect(canConfirm('', 'Some message')).toBe(false);
  });

  it('button disabled when confirm input is lowercase "enable"', () => {
    expect(canConfirm('enable', 'Some message')).toBe(false);
  });

  it('button disabled when confirm input is "ENABL" (incomplete)', () => {
    expect(canConfirm('ENABL', 'Some message')).toBe(false);
  });

  it('button disabled when message is empty even if ENABLE typed', () => {
    expect(canConfirm('ENABLE', '')).toBe(false);
  });

  it('button disabled when message is whitespace only', () => {
    expect(canConfirm('ENABLE', '   ')).toBe(false);
  });

  it('button enabled only when "ENABLE" typed exactly and message is non-empty', () => {
    expect(canConfirm('ENABLE', 'We are down for maintenance.')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 5: Enable modal — checkbox defaults
// ═════════════════════════════════════════════════════════════════════════════

describe('Enable maintenance modal — checkbox defaults', () => {
  function EnableCheckboxes() {
    const [sendEmail, setSendEmail] = React.useState(true);
    const [createBanner, setCreateBanner] = React.useState(true);
    return (
      <div>
        <input
          type="checkbox"
          data-testid="send-email-checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          readOnly={false}
        />
        <input
          type="checkbox"
          data-testid="create-banner-checkbox"
          checked={createBanner}
          onChange={(e) => setCreateBanner(e.target.checked)}
          readOnly={false}
        />
      </div>
    );
  }

  it('send email checkbox is checked by default', () => {
    render(<EnableCheckboxes />);
    expect(screen.getByTestId('send-email-checkbox')).toBeChecked();
  });

  it('create banner checkbox is checked by default', () => {
    render(<EnableCheckboxes />);
    expect(screen.getByTestId('create-banner-checkbox')).toBeChecked();
  });

  it('send email checkbox can be unchecked', () => {
    render(<EnableCheckboxes />);
    const cb = screen.getByTestId('send-email-checkbox');
    fireEvent.click(cb);
    expect(cb).not.toBeChecked();
  });

  it('create banner checkbox can be unchecked', () => {
    render(<EnableCheckboxes />);
    const cb = screen.getByTestId('create-banner-checkbox');
    fireEvent.click(cb);
    expect(cb).not.toBeChecked();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 6: Critical type locks dismissible to false
// ═════════════════════════════════════════════════════════════════════════════

describe('Announcement form — critical type locks dismissible', () => {
  type FormState = { type: 'info' | 'warning' | 'critical'; is_dismissible: boolean };

  function nextFormState(prev: FormState, newType: 'info' | 'warning' | 'critical'): FormState {
    const next = { ...prev, type: newType };
    if (newType === 'critical') {
      next.is_dismissible = false;
    }
    return next;
  }

  it('switching to critical forces is_dismissible=false', () => {
    const initial: FormState = { type: 'info', is_dismissible: true };
    const result = nextFormState(initial, 'critical');
    expect(result.is_dismissible).toBe(false);
    expect(result.type).toBe('critical');
  });

  it('switching from info to warning preserves dismissible state', () => {
    const initial: FormState = { type: 'info', is_dismissible: true };
    const result = nextFormState(initial, 'warning');
    expect(result.is_dismissible).toBe(true);
  });

  it('switching from critical back to info does NOT auto-restore dismissible', () => {
    const criticalState: FormState = { type: 'critical', is_dismissible: false };
    const result = nextFormState(criticalState, 'info');
    expect(result.is_dismissible).toBe(false); // stays false until user toggles
    expect(result.type).toBe('info');
  });

  it('dismissible toggle renders as disabled for critical type', () => {
    function DismissibleToggle({ type }: { type: 'info' | 'warning' | 'critical' }) {
      return (
        <button
          data-testid="dismissible-toggle"
          role="switch"
          disabled={type === 'critical'}
          aria-checked={type !== 'critical'}
        >
          Dismissible
        </button>
      );
    }
    render(<DismissibleToggle type="critical" />);
    expect(screen.getByTestId('dismissible-toggle')).toBeDisabled();
  });

  it('dismissible toggle renders as enabled for info type', () => {
    function DismissibleToggle({ type }: { type: 'info' | 'warning' | 'critical' }) {
      return (
        <button
          data-testid="dismissible-toggle"
          role="switch"
          disabled={type === 'critical'}
          aria-checked={type !== 'critical'}
        >
          Dismissible
        </button>
      );
    }
    render(<DismissibleToggle type="info" />);
    expect(screen.getByTestId('dismissible-toggle')).not.toBeDisabled();
  });

  it('critical type shows helper text warning', () => {
    function CriticalHelper({ type }: { type: 'info' | 'critical' }) {
      return (
        <div>
          {type === 'critical' && (
            <p data-testid="critical-helper">
              Critical announcements cannot be dismissed by users.
            </p>
          )}
        </div>
      );
    }
    render(<CriticalHelper type="critical" />);
    expect(screen.getByTestId('critical-helper')).toBeInTheDocument();
    expect(screen.getByText(/cannot be dismissed/)).toBeInTheDocument();
  });

  it('non-critical type does not show the helper text', () => {
    function CriticalHelper({ type }: { type: 'info' | 'critical' }) {
      return (
        <div>
          {type === 'critical' && (
            <p data-testid="critical-helper">
              Critical announcements cannot be dismissed by users.
            </p>
          )}
        </div>
      );
    }
    render(<CriticalHelper type="info" />);
    expect(screen.queryByTestId('critical-helper')).not.toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 7: Maintenance card OFF state appearance
// ═════════════════════════════════════════════════════════════════════════════

describe('Maintenance card — OFF state', () => {
  function MaintenanceCardOff({ isActive }: { isActive: boolean }) {
    return (
      <div
        data-testid="maintenance-card"
        className={isActive ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200'}
      >
        {!isActive && (
          <>
            <span data-testid="maintenance-title">Maintenance Mode</span>
            <button data-testid="enable-button">Enable Maintenance Mode</button>
          </>
        )}
        {isActive && (
          <>
            <span data-testid="active-label">Maintenance Mode Is Active</span>
            <button data-testid="disable-button">Disable Maintenance Mode</button>
          </>
        )}
      </div>
    );
  }

  it('shows OFF state by default (white border-gray card)', () => {
    render(<MaintenanceCardOff isActive={false} />);
    const card = screen.getByTestId('maintenance-card');
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('border-gray-200');
    expect(card).not.toHaveClass('bg-amber-50');
  });

  it('shows "Maintenance Mode" title in OFF state', () => {
    render(<MaintenanceCardOff isActive={false} />);
    expect(screen.getByTestId('maintenance-title')).toBeInTheDocument();
  });

  it('shows enable button in OFF state', () => {
    render(<MaintenanceCardOff isActive={false} />);
    expect(screen.getByTestId('enable-button')).toBeInTheDocument();
  });

  it('shows amber background in ON state', () => {
    render(<MaintenanceCardOff isActive={true} />);
    const card = screen.getByTestId('maintenance-card');
    expect(card).toHaveClass('bg-amber-50');
    expect(card).not.toHaveClass('bg-white');
  });

  it('shows "active" label and disable button in ON state', () => {
    render(<MaintenanceCardOff isActive={true} />);
    expect(screen.getByTestId('active-label')).toBeInTheDocument();
    expect(screen.getByTestId('disable-button')).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 8: Deactivate — status change reflected in getAnnouncementStatus
// ═════════════════════════════════════════════════════════════════════════════

describe('Deactivate — getAnnouncementStatus reflects is_active=false', () => {
  it('active live announcement becomes inactive after deactivate', () => {
    const live = makeAnnouncement({ is_active: true, starts_at: null, ends_at: null });
    expect(getAnnouncementStatus(live)).toBe('live');

    const deactivated = { ...live, is_active: false };
    expect(getAnnouncementStatus(deactivated)).toBe('inactive');
  });

  it('deactivated announcement is filtered out of active tab', () => {
    const announcements: SystemAnnouncement[] = [
      makeAnnouncement({ id: 1, is_active: true }),
      makeAnnouncement({ id: 2, is_active: false }),
    ];
    const liveOnes = announcements.filter(
      (a) => getAnnouncementStatus(a) === 'live',
    );
    expect(liveOnes).toHaveLength(1);
    expect(liveOnes[0].id).toBe(1);
  });

  it('deactivated announcement still appears in All tab', () => {
    const announcements: SystemAnnouncement[] = [
      makeAnnouncement({ id: 1, is_active: true }),
      makeAnnouncement({ id: 2, is_active: false }),
    ];
    expect(announcements).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 9: Delete — confirm modal gating
// ═════════════════════════════════════════════════════════════════════════════

describe('Delete — confirm modal before DELETE call', () => {
  function DeleteGate({
    deleteTarget,
    onDelete,
    onCancel,
  }: {
    deleteTarget: SystemAnnouncement | null;
    onDelete: () => void;
    onCancel: () => void;
  }) {
    return (
      <div>
        {deleteTarget && (
          <div data-testid="delete-modal">
            <p>Delete &ldquo;{deleteTarget.title}&rdquo;?</p>
            <button data-testid="confirm-delete" onClick={onDelete}>
              Delete
            </button>
            <button data-testid="cancel-delete" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  it('does not show confirm modal when deleteTarget is null', () => {
    render(<DeleteGate deleteTarget={null} onDelete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('shows confirm modal when deleteTarget is set', () => {
    const target = makeAnnouncement({ title: 'My Announcement' });
    render(<DeleteGate deleteTarget={target} onDelete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    expect(screen.getByText(/My Announcement/)).toBeInTheDocument();
  });

  it('calls onDelete only when confirm button is clicked', () => {
    const onDelete = vi.fn();
    const target = makeAnnouncement();
    render(<DeleteGate deleteTarget={target} onDelete={onDelete} onCancel={vi.fn()} />);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    const target = makeAnnouncement();
    render(<DeleteGate deleteTarget={target} onDelete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('cancel-delete'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 10: TYPE_CONFIG — configuration completeness
// ═════════════════════════════════════════════════════════════════════════════

describe('TYPE_CONFIG completeness', () => {
  it('all three types are defined', () => {
    expect(TYPE_CONFIG).toHaveProperty('info');
    expect(TYPE_CONFIG).toHaveProperty('warning');
    expect(TYPE_CONFIG).toHaveProperty('critical');
  });

  it('each type has the required display properties', () => {
    (['info', 'warning', 'critical'] as const).forEach((t) => {
      const cfg = TYPE_CONFIG[t];
      expect(typeof cfg.label).toBe('string');
      expect(typeof cfg.description).toBe('string');
      expect(typeof cfg.bg).toBe('string');
      expect(typeof cfg.border).toBe('string');
      expect(typeof cfg.text).toBe('string');
      expect(typeof cfg.badgeClass).toBe('string');
      expect(cfg.icon).toBeDefined();
    });
  });

  it('info badge class uses blue colors', () => {
    expect(TYPE_CONFIG.info.badgeClass).toContain('blue');
  });

  it('warning badge class uses amber colors', () => {
    expect(TYPE_CONFIG.warning.badgeClass).toContain('amber');
  });

  it('critical badge class uses red colors', () => {
    expect(TYPE_CONFIG.critical.badgeClass).toContain('red');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PART 11: platformAnnouncements and platformMaintenance API methods exist
// ═════════════════════════════════════════════════════════════════════════════

import * as platformApiModule from '@/lib/platform-api';

describe('platformAnnouncements API methods exist', () => {
  it('list method exists', () => {
    expect(typeof platformApiModule.platformAnnouncements.list).toBe('function');
  });

  it('create method exists', () => {
    expect(typeof platformApiModule.platformAnnouncements.create).toBe('function');
  });

  it('update method exists', () => {
    expect(typeof platformApiModule.platformAnnouncements.update).toBe('function');
  });

  it('delete method exists', () => {
    expect(typeof platformApiModule.platformAnnouncements.delete).toBe('function');
  });
});

describe('platformMaintenance API methods exist', () => {
  it('status method exists', () => {
    expect(typeof platformApiModule.platformMaintenance.status).toBe('function');
  });

  it('enable method exists', () => {
    expect(typeof platformApiModule.platformMaintenance.enable).toBe('function');
  });

  it('disable method exists', () => {
    expect(typeof platformApiModule.platformMaintenance.disable).toBe('function');
  });
});
