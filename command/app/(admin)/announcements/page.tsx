'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Megaphone,
  Plus,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  platformAnnouncements,
  platformMaintenance,
  type SystemAnnouncement,
  type AnnouncementType,
  type MaintenanceStatus,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAINTENANCE_MESSAGE =
  "Wayfield is currently undergoing scheduled maintenance. We'll be back shortly. Thank you for your patience.";

type AnnouncementStatus = 'live' | 'scheduled' | 'expired' | 'inactive';
type FilterTab = 'all' | 'active' | 'scheduled' | 'expired';

export const TYPE_CONFIG = {
  info: {
    label: 'Info',
    description: 'Informational notices, feature releases',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: Info,
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  warning: {
    label: 'Warning',
    description: 'Service degradation, upcoming maintenance',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  critical: {
    label: 'Critical',
    description: 'Outage, data issues, urgent action needed',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: AlertCircle,
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAnnouncementStatus(a: SystemAnnouncement): AnnouncementStatus {
  const now = new Date();
  if (!a.is_active) return 'inactive';
  if (a.ends_at && new Date(a.ends_at) < now) return 'expired';
  if (a.starts_at && new Date(a.starts_at) > now) return 'scheduled';
  return 'live';
}

export function getRowBorderClass(status: AnnouncementStatus, type: string): string {
  if (status === 'live' && type === 'critical') return 'border-l-2 border-l-red-400';
  if (status === 'live') return 'border-l-2 border-l-teal-400';
  return 'border-l-2 border-l-transparent';
}

function filterByTab(items: SystemAnnouncement[], tab: FilterTab): SystemAnnouncement[] {
  if (tab === 'all') return items;
  const map: Record<Exclude<FilterTab, 'all'>, AnnouncementStatus> = {
    active: 'live',
    scheduled: 'scheduled',
    expired: 'expired',
  };
  return items.filter((a) => getAnnouncementStatus(a) === map[tab]);
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy HH:mm');
  } catch {
    return '—';
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  const configs: Record<AnnouncementStatus, { cls: string; label: string }> = {
    live:      { cls: 'bg-teal-50 text-teal-700 border border-teal-100',  label: 'Live' },
    scheduled: { cls: 'bg-blue-50 text-blue-700 border border-blue-100',  label: 'Scheduled' },
    expired:   { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Expired' },
    inactive:  { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Inactive' },
  };
  const { cls, label } = configs[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type as AnnouncementType] ?? TYPE_CONFIG.info;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

// ─── Live Banner Preview ──────────────────────────────────────────────────────

export function BannerPreview({
  title,
  message,
  type,
}: {
  title: string;
  message: string;
  type: AnnouncementType;
}) {
  const { bg, border, text, icon: Icon } = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const empty = !title && !message;
  return (
    <div className={`rounded-lg border ${bg} ${border} px-4 py-3 flex items-start gap-3`}>
      <Icon size={16} className={`${text} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {empty ? (
          <p className={`text-sm ${text} italic opacity-60`}>
            Preview will appear here as you type…
          </p>
        ) : (
          <>
            {title && <p className={`text-sm font-semibold ${text}`}>{title}</p>}
            {message && <p className={`text-sm ${text} ${title ? 'mt-0.5' : ''}`}>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Announcement Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'info' as AnnouncementType,
  is_dismissible: true,
  starts_at: '',
  ends_at: '',
  send_email: false,
};

function AnnouncementModal({
  announcement,
  onClose,
  onSaved,
}: {
  announcement: SystemAnnouncement | null;
  onClose: () => void;
  onSaved: (a: SystemAnnouncement) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => {
    if (!announcement) return EMPTY_FORM;
    return {
      title: announcement.title,
      message: announcement.message,
      type: (announcement.announcement_type as AnnouncementType) || 'info',
      is_dismissible: announcement.is_dismissable,
      starts_at: announcement.starts_at ? announcement.starts_at.slice(0, 16) : '',
      ends_at: announcement.ends_at ? announcement.ends_at.slice(0, 16) : '',
      send_email: false,
    };
  });
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'type' && value === 'critical') {
        next.is_dismissible = false;
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        announcement_type: form.type,        // backend field name
        is_dismissable: form.is_dismissible, // backend field name (one 's')
        starts_at: form.starts_at || null,   // null → backend defaults to now()
        ends_at: form.ends_at || null,
        send_email: form.send_email,
      };
      let result: SystemAnnouncement;
      if (announcement) {
        const { data } = await platformAnnouncements.update(announcement.id, payload);
        result = data;
      } else {
        const { data } = await platformAnnouncements.create(payload);
        result = data;
      }
      onSaved(result);
      toast(announcement ? 'Announcement updated.' : 'Announcement created.', 'success');
    } catch {
      toast('Failed to save announcement.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const isValid = form.title.trim().length > 0 && form.message.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-heading text-lg font-semibold text-gray-900">
            {announcement ? 'Edit Announcement' : 'New System Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={255}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Announcement title"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-[#0FA3B1]"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              rows={3}
              placeholder="Announcement message visible to users…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-[#0FA3B1] resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="space-y-2">
              {(Object.keys(TYPE_CONFIG) as AnnouncementType[]).map((t) => {
                const { label, description, bg, border, text } = TYPE_CONFIG[t];
                const active = form.type === t;
                return (
                  <label
                    key={t}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      active ? `${bg} ${border}` : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="announcement-type"
                      value={t}
                      checked={active}
                      onChange={() => setField('type', t)}
                      className="sr-only"
                    />
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        active ? `${text} border-current` : 'border-gray-300'
                      }`}
                    >
                      {active && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    <div>
                      <span className={`text-sm font-medium ${active ? text : 'text-gray-700'}`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">— {description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Dismissible */}
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_dismissible}
                data-testid="dismissible-toggle"
                disabled={form.type === 'critical'}
                onClick={() => {
                  if (form.type !== 'critical') setField('is_dismissible', !form.is_dismissible);
                }}
                className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:ring-offset-1 ${
                  form.is_dismissible ? 'bg-[#0FA3B1]' : 'bg-gray-300'
                } ${form.type === 'critical' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.is_dismissible ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700">Dismissible</span>
            </div>
            {form.type === 'critical' && (
              <p className="mt-1.5 text-xs text-red-600">
                Critical announcements cannot be dismissed by users.
              </p>
            )}
          </div>

          {/* Display window */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display window{' '}
              <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Starts at</label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setField('starts_at', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ends at</label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setField('ends_at', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Leave empty for immediate display / no expiry.
            </p>
          </div>

          {/* Send email */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.send_email}
                onChange={(e) => setField('send_email', e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Send email to all organizers
                </span>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sends an email immediately on save. Cannot be undone.
                </p>
                {form.send_email && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    ⚠ This will send an email to all org owners and admins.
                  </p>
                )}
              </div>
            </label>
          </div>

          {/* Live Preview */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-mono mb-2">
              Preview — how this appears in the web admin:
            </p>
            <BannerPreview title={form.title} message={form.message} type={form.type} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white sticky bottom-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : announcement ? 'Save Changes' : 'Create Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enable Maintenance Modal ─────────────────────────────────────────────────

function EnableMaintenanceModal({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [endsAt, setEndsAt] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [createBanner, setCreateBanner] = useState(true);
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmInput === 'ENABLE' && message.trim().length > 0;

  async function handleEnable() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await platformMaintenance.enable({
        message: message.trim(),
        ends_at: endsAt || null,
        send_email: sendEmail,
        create_banner: createBanner,
      });
      toast('Maintenance mode enabled.', 'success');
      onEnabled();
    } catch {
      toast('Failed to enable maintenance mode.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-gray-900">
            Enable Maintenance Mode
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                This will immediately block all organizer and participant access.
                All API routes will return 503. Only platform admins can access the CC.
              </p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] resize-none"
            />
          </div>

          {/* Expected end time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Expected end time{' '}
              <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                data-testid="send-email-checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <span className="text-sm text-gray-700">
                Send email notification to all organizers
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                data-testid="create-banner-checkbox"
                checked={createBanner}
                onChange={(e) => setCreateBanner(e.target.checked)}
                className="rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <span className="text-sm text-gray-700">
                Create matching announcement banner
              </span>
              {createBanner && (
                <span className="text-xs text-blue-600">(type: warning)</span>
              )}
            </label>
          </div>

          {/* Type-to-confirm */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type{' '}
              <code className="bg-gray-200 px-1 rounded text-xs font-mono">ENABLE</code>{' '}
              to confirm
            </label>
            <input
              type="text"
              data-testid="enable-confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="ENABLE"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="enable-confirm-button"
            onClick={handleEnable}
            disabled={!canConfirm || loading}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#E67E22] rounded-lg hover:bg-[#d36f1e] disabled:opacity-40 transition-colors"
          >
            {loading ? 'Enabling…' : 'Enable Maintenance Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (adminUser && !can.manageAnnouncements(adminUser.role)) {
      router.replace('/');
    }
  }, [adminUser, router]);

  // Maintenance
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemAnnouncement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const loadMaintenance = useCallback(() => {
    setMaintenanceLoading(true);
    platformMaintenance
      .status()
      .then(({ data }) => setMaintenanceStatus(data))
      .catch(() => {})
      .finally(() => setMaintenanceLoading(false));
  }, []);

  const loadAnnouncements = useCallback(() => {
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    platformAnnouncements
      .list()
      .then(({ data }) => setAnnouncements(data.data))
      .catch(() => setAnnouncementsError('Failed to load announcements.'))
      .finally(() => setAnnouncementsLoading(false));
  }, []);

  useEffect(() => {
    loadMaintenance();
    loadAnnouncements();
  }, [loadMaintenance, loadAnnouncements]);

  async function handleDisable() {
    setDisabling(true);
    try {
      await platformMaintenance.disable();
      setDisableModalOpen(false);
      toast('Maintenance mode disabled.', 'success');
      loadMaintenance();
    } catch {
      toast('Failed to disable maintenance mode.', 'error');
    } finally {
      setDisabling(false);
    }
  }

  async function handleDeactivate(a: SystemAnnouncement) {
    setDeactivatingId(a.id);
    try {
      const { data } = await platformAnnouncements.update(a.id, { is_active: false });
      setAnnouncements((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      toast('Announcement deactivated.', 'success');
    } catch {
      toast('Failed to deactivate announcement.', 'error');
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await platformAnnouncements.delete(deleteTarget.id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast('Announcement deleted.', 'success');
      setDeleteTarget(null);
    } catch {
      toast('Failed to delete announcement.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleSaved(saved: SystemAnnouncement) {
    setAnnouncements((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      return idx >= 0 ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
    setModalOpen(false);
    setEditingAnnouncement(null);
  }

  if (!adminUser || !can.manageAnnouncements(adminUser.role)) return null;

  const isMaintenanceActive = maintenanceStatus?.maintenance_mode ?? false;
  const filteredAnnouncements = filterByTab(announcements, activeTab);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'expired', label: 'Expired' },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="System announcements and maintenance controls"
        right={
          <button
            onClick={() => {
              setEditingAnnouncement(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 min-h-[44px] px-4 bg-[#0FA3B1] text-white text-sm font-medium rounded-lg hover:bg-[#0d8f9c] transition-colors"
          >
            <Plus size={16} />
            Create Announcement
          </button>
        }
      />

      {/* Maintenance Mode Card */}
      {maintenanceLoading ? (
        <div className="animate-pulse bg-gray-100 rounded-2xl h-28 mb-8" />
      ) : (
        <div
          data-testid="maintenance-card"
          className={`rounded-2xl border-2 shadow-md p-8 mb-8 transition-colors ${
            isMaintenanceActive
              ? 'bg-amber-50 border-amber-400'
              : 'bg-white border-gray-200'
          }`}
        >
          {isMaintenanceActive ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Wrench size={24} className="text-amber-600 shrink-0" />
                  <span className="font-mono text-sm font-bold uppercase tracking-widest text-amber-800">
                    Maintenance Mode Is Active
                  </span>
                </div>
                {maintenanceStatus?.maintenance_message && (
                  <p className="text-sm text-amber-700 mb-1">{maintenanceStatus.maintenance_message}</p>
                )}
                {maintenanceStatus?.maintenance_ends_at && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 font-mono">
                    <Clock size={12} />
                    Ends{' '}
                    {formatDistanceToNow(new Date(maintenanceStatus.maintenance_ends_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDisableModalOpen(true)}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] transition-colors shrink-0"
              >
                Disable Maintenance Mode
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 flex items-start gap-3">
                <Wrench size={24} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-heading text-lg font-semibold text-gray-900">
                    Maintenance Mode
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Disables access to all tenant features. Use for infrastructure work.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEnableModalOpen(true)}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#E67E22] rounded-lg hover:bg-[#d36f1e] transition-colors shrink-0"
              >
                Enable Maintenance Mode
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-[44px] px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#0FA3B1] text-[#0FA3B1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {announcementsError && (
        <div className="mb-4">
          <ErrorBanner message={announcementsError} onRetry={loadAnnouncements} />
        </div>
      )}

      <Table>
        <TableHead>
          <Th>Title</Th>
          <Th>Type</Th>
          <Th>Status</Th>
          <Th>Starts</Th>
          <Th>Ends</Th>
          <Th>Created By</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </TableHead>
        <TableBody>
          {announcementsLoading ? (
            [...Array(4)].map((_, i) => (
              <tr key={i}>
                <td colSpan={7} className="px-4 py-1">
                  <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
                </td>
              </tr>
            ))
          ) : filteredAnnouncements.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={Megaphone}
                  heading="No announcements"
                  subtitle="Create an announcement to communicate with all organizers."
                />
              </td>
            </tr>
          ) : (
            filteredAnnouncements.map((a) => {
              const status = getAnnouncementStatus(a);
              const rowBorder = getRowBorderClass(status, a.announcement_type);
              return (
                <tr
                  key={a.id}
                  data-testid={`announcement-row-${a.id}`}
                  className={`hover:bg-gray-50 transition-colors ${rowBorder}`}
                >
                  <Td>
                    <div className="font-medium text-gray-900 text-sm">{a.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                      {a.message}
                    </div>
                  </Td>
                  <Td>
                    <TypeBadge type={a.announcement_type} />
                  </Td>
                  <Td>
                    <StatusBadge status={status} />
                  </Td>
                  <Td className="text-sm text-gray-500">{formatDateDisplay(a.starts_at)}</Td>
                  <Td className="text-sm text-gray-500">{formatDateDisplay(a.ends_at)}</Td>
                  <Td className="text-sm text-gray-500">{a.created_by_admin_id ? `Admin #${a.created_by_admin_id}` : '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAnnouncement(a);
                          setModalOpen(true);
                        }}
                        className="text-xs text-[#0FA3B1] hover:text-[#0d8f9c] px-2 py-1 rounded hover:bg-teal-50 transition-colors min-h-[44px]"
                        aria-label={`Edit ${a.title}`}
                      >
                        Edit
                      </button>
                      {a.is_active && (
                        <button
                          onClick={() => handleDeactivate(a)}
                          disabled={deactivatingId === a.id}
                          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors min-h-[44px]"
                          aria-label={`Deactivate ${a.title}`}
                        >
                          {deactivatingId === a.id ? '…' : 'Deactivate'}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[44px]"
                        aria-label={`Delete ${a.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Enable maintenance modal */}
      {enableModalOpen && (
        <EnableMaintenanceModal
          onClose={() => setEnableModalOpen(false)}
          onEnabled={() => {
            setEnableModalOpen(false);
            loadMaintenance();
            loadAnnouncements();
          }}
        />
      )}

      {/* Disable maintenance modal */}
      {disableModalOpen && (
        <ConfirmModal
          title="Disable Maintenance Mode?"
          body="Maintenance mode will be disabled. Tenant access will resume immediately."
          confirmLabel="Disable"
          loading={disabling}
          onConfirm={handleDisable}
          onCancel={() => setDisableModalOpen(false)}
        />
      )}

      {/* Create / edit announcement modal */}
      {modalOpen && (
        <AnnouncementModal
          announcement={editingAnnouncement}
          onClose={() => {
            setModalOpen(false);
            setEditingAnnouncement(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Announcement"
          body={
            <>
              Are you sure you want to delete{' '}
              <strong>&ldquo;{deleteTarget.title}&rdquo;</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          destructive
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
