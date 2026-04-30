'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Bell, AlertCircle, Info, Clock, ChevronDown, Eye } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { NotificationDetailSlideOver, SlideOverNotification } from '@/components/notifications/NotificationDetailSlideOver';

/* --- Types ----------------------------------------------------------- */

type NotificationType = 'informational' | 'urgent' | 'reminder';
type DeliveryScope = 'all_participants' | 'leaders' | 'session_participants' | 'custom';
type SenderScope = 'organizer' | 'leader';
type FilterScope = 'all' | 'organizer' | 'leader';

interface Workshop {
  id: number;
  title: string;
  timezone: string;
}

interface Session {
  id: number;
  title: string;
  is_published: boolean;
}

interface SentNotification {
  id: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  delivery_scope: DeliveryScope;
  sender_scope: SenderScope;
  session_id: number | null;
  session_title?: string | null;
  session_start_at?: string | null;
  recipient_count: number | null;
  sent_at: string | null;
  sent_by?: { first_name: string; last_name: string } | null;
  created_at: string;
}

/* --- Constants -------------------------------------------------------- */

const MAX_MESSAGE = 500;
const OWNER_ADMIN_ROLES = ['owner', 'admin'] as const;

const FILTER_TABS: Array<{ value: FilterScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'leader', label: 'Leader' },
];

const EMPTY_STATE_LABELS: Record<FilterScope, string> = {
  all: 'No notifications sent yet.',
  organizer: 'No organizer notifications yet.',
  leader: 'No leader notifications yet.',
};

/* --- Type pill toggle ------------------------------------------------- */

const typeConfig: Record<NotificationType, { label: string; icon: React.ReactNode; activeClass: string }> = {
  informational: {
    label: 'Informational',
    icon: <Info className="w-3.5 h-3.5" />,
    activeClass: 'bg-info/10 text-info border-info/30',
  },
  urgent: {
    label: 'Urgent',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    activeClass: 'bg-danger/10 text-danger border-danger/30',
  },
  reminder: {
    label: 'Reminder',
    icon: <Clock className="w-3.5 h-3.5" />,
    activeClass: 'bg-secondary/10 text-secondary border-secondary/30',
  },
};

function TypePillToggle({
  value,
  onChange,
}: {
  value: NotificationType;
  onChange: (v: NotificationType) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-dark block mb-1.5">Notification type</label>
      <div className="flex gap-2">
        {(Object.keys(typeConfig) as NotificationType[]).map((type) => {
          const cfg = typeConfig[type];
          const isActive = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${isActive ? cfg.activeClass : 'bg-white border-border-gray text-medium-gray hover:bg-surface hover:text-dark'}
              `}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --- Type badge (history) --------------------------------------------- */

const typeBadgeClasses: Record<NotificationType, string> = {
  informational: 'bg-info/10 text-info',
  urgent:        'bg-danger/10 text-danger',
  reminder:      'bg-secondary/10 text-secondary',
};

function TypeBadge({ type }: { type: NotificationType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${typeBadgeClasses[type]}`}>
      {type}
    </span>
  );
}

/* --- Scope label ------------------------------------------------------ */

const scopeLabels: Record<DeliveryScope, string> = {
  all_participants:     'All Participants',
  leaders:             'Leaders Only',
  session_participants: 'Session Participants',
  custom:              'Custom',
};

function scopeLabel(n: SentNotification): string {
  if (n.sender_scope === 'leader') {
    return n.session_title ? `Session: ${n.session_title}` : 'Session Participants';
  }
  return scopeLabels[n.delivery_scope] ?? n.delivery_scope;
}

function senderLabel(n: SentNotification): string {
  if (!n.sent_by) return '—';
  const name = `${n.sent_by.first_name} ${n.sent_by.last_name}`;
  return n.sender_scope === 'leader' ? `Leader: ${name}` : name;
}

/* --- Compose section -------------------------------------------------- */

function ComposeSection({
  workshopId,
  sessions,
  isOwnerAdmin,
  onSent,
}: {
  workshopId: string;
  sessions: Session[];
  isOwnerAdmin: boolean;
  onSent: () => void;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notifType, setNotifType] = useState<NotificationType>('informational');
  const [scope, setScope] = useState<DeliveryScope>(
    isOwnerAdmin ? 'all_participants' : 'session_participants',
  );
  const [sessionId, setSessionId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [messageError, setMessageError] = useState('');

  const showSessionSelector = scope === 'session_participants';
  const charsLeft = MAX_MESSAGE - message.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (!title.trim()) { setTitleError('Title is required'); valid = false; }
    else setTitleError('');

    if (!message.trim()) { setMessageError('Message is required'); valid = false; }
    else if (message.length > MAX_MESSAGE) { setMessageError(`Maximum ${MAX_MESSAGE} characters`); valid = false; }
    else setMessageError('');

    if (!valid) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        notification_type: notifType,
        delivery_scope: scope,
      };
      if (showSessionSelector && sessionId) {
        body.session_id = Number(sessionId);
      }

      await apiPost<SentNotification>(`/workshops/${workshopId}/notifications`, body);

      toast.success('Notification queued for delivery');
      onSent();

      setTitle('');
      setMessage('');
      setNotifType('informational');
      setScope(isOwnerAdmin ? 'all_participants' : 'session_participants');
      setSessionId('');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const first = Object.values(err.errors)[0]?.[0];
        toast.error(first ?? err.message);
      } else {
        toast.error('Failed to send notification');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border-gray p-6">
      <h2 className="font-heading text-base font-semibold text-dark mb-5">Compose</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          error={titleError}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-dark">Message</label>
            <span className={`text-xs tabular-nums ${charsLeft < 50 ? 'text-danger' : 'text-light-gray'}`}>
              {charsLeft} remaining
            </span>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message…"
            rows={4}
            maxLength={MAX_MESSAGE}
            error={messageError}
          />
        </div>

        <TypePillToggle value={notifType} onChange={setNotifType} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark">Delivery scope</label>
          <div className="relative">
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as DeliveryScope);
                setSessionId('');
              }}
              className="w-full h-10 pl-3 pr-10 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none appearance-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {isOwnerAdmin && (
                <>
                  <option value="all_participants">All Participants</option>
                  <option value="leaders">Leaders Only</option>
                </>
              )}
              <option value="session_participants">Session Participants</option>
              <option value="custom" disabled>
                Custom — Coming in a future update
              </option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            showSessionSelector ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="pt-1">
            <label className="text-sm font-medium text-dark block mb-1.5">Session</label>
            <div className="relative">
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full h-10 pl-3 pr-10 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none appearance-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select a session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="pt-1">
          <Button type="submit" variant="primary" size="md" loading={sending} className="w-full">
            Send Notification
          </Button>
        </div>
      </form>
    </div>
  );
}

/* --- History skeleton ------------------------------------------------- */

function HistorySkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i}>
          <td className="px-4 py-3"><div className="h-4 w-28 bg-border-gray rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-24 bg-border-gray rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-5 w-20 bg-border-gray rounded-full animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 bg-border-gray rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 bg-border-gray rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-8 bg-border-gray rounded animate-pulse ml-auto" /></td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
}

/* --- History section -------------------------------------------------- */

function HistorySection({
  notifications,
  filterScope,
  onFilterChange,
  loading,
  onView,
}: {
  notifications: SentNotification[];
  filterScope: FilterScope;
  onFilterChange: (scope: FilterScope) => void;
  loading: boolean;
  onView: (n: SentNotification) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-border-gray overflow-hidden">
      {/* Header + filter tabs */}
      <div className="px-5 py-4 border-b border-border-gray">
        <h2 className="font-heading text-base font-semibold text-dark mb-3">History</h2>
        <div className="flex items-center gap-1.5">
          {FILTER_TABS.map(({ value, label }) => {
            const active = filterScope === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-medium-gray hover:text-dark hover:bg-surface border border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="py-14 px-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-3">
            <Bell className="w-5 h-5 text-light-gray" />
          </div>
          <p className="text-sm text-medium-gray">{EMPTY_STATE_LABELS[filterScope]}</p>
        </div>
      )}

      {/* Table */}
      {(loading || notifications.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-gray bg-surface">
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Sender
                </th>
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Scope
                </th>
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Sent
                </th>
                <th className="text-right px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Recipients
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-gray">
              {loading ? (
                <HistorySkeleton />
              ) : (
                notifications.map((n, index) => {
                  const isLeader = n.sender_scope === 'leader';
                  const sentAtFormatted = n.sent_at
                    ? format(new Date(n.sent_at), "MMMM d, yyyy 'at' h:mm a")
                    : undefined;

                  return (
                    <tr
                      key={`notification-${n.id}-${index}`}
                      className="hover:bg-surface/50 transition-colors"
                    >
                      {/* TITLE — orange left border for leader rows */}
                      <td
                        className="px-4 py-3 max-w-[160px]"
                        style={isLeader ? { borderLeft: '3px solid #E67E22' } : { borderLeft: '3px solid transparent' }}
                      >
                        <button
                          type="button"
                          onClick={() => onView(n)}
                          className="block truncate font-medium text-dark hover:text-primary transition-colors text-left w-full"
                          title={n.title}
                        >
                          {n.title}
                        </button>
                      </td>

                      {/* SENDER */}
                      <td className="px-4 py-3 whitespace-nowrap text-medium-gray text-xs">
                        {isLeader ? (
                          <span className="font-medium" style={{ color: '#92400E' }}>
                            {senderLabel(n)}
                          </span>
                        ) : (
                          senderLabel(n)
                        )}
                      </td>

                      {/* TYPE + Leader badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <TypeBadge type={n.notification_type} />
                          {isLeader && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                              Leader
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SCOPE */}
                      <td className="px-4 py-3 whitespace-nowrap text-medium-gray text-xs">
                        {scopeLabel(n)}
                      </td>

                      {/* SENT — hover shows exact time */}
                      <td
                        className="px-4 py-3 whitespace-nowrap text-medium-gray text-xs"
                        title={sentAtFormatted}
                      >
                        {n.sent_at
                          ? formatDistanceToNow(new Date(n.sent_at), { addSuffix: true })
                          : <span className="text-light-gray italic">Queued</span>}
                      </td>

                      {/* RECIPIENTS */}
                      <td className="px-4 py-3 text-right text-medium-gray text-xs tabular-nums">
                        {n.recipient_count ?? '—'}
                      </td>

                      {/* VIEW */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onView(n)}
                          title="View details"
                          className="p-1.5 rounded-lg text-light-gray hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --- Page ------------------------------------------------------------- */

export default function WorkshopNotificationsPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();
  const { currentOrg } = useUser();

  const isOwnerAdmin = OWNER_ADMIN_ROLES.includes(
    (currentOrg?.role ?? '') as typeof OWNER_ADMIN_ROLES[number],
  );

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [selectedNotification, setSelectedNotification] = useState<SlideOverNotification | null>(null);

  const loadHistory = useCallback(async (scope: FilterScope) => {
    setHistoryLoading(true);
    try {
      const qs = scope !== 'all' ? `?sender_scope=${scope}` : '';
      const raw = await apiGet<SentNotification[]>(`/workshops/${id}/notifications${qs}`).catch(() => []);
      const unique = Array.from(
        new Map((raw ?? []).map((n: SentNotification) => [n.id, n])).values(),
      );
      setHistory(unique);
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  // Initial page load: workshop + sessions
  useEffect(() => {
    async function init() {
      try {
        const [wRes, sRes] = await Promise.all([
          apiGet<Workshop>(`/workshops/${id}`),
          apiGet<Session[]>(`/workshops/${id}/sessions`),
        ]);
        setWorkshop(wRes);
        setSessions((sRes ?? []).filter((s) => s.is_published));
      } catch {
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  // Load (and reload) history whenever filter changes
  useEffect(() => {
    loadHistory(filterScope);
  }, [filterScope, loadHistory]);

  useEffect(() => {
    const t = workshop?.title ?? 'Workshop';
    setPage(t, [
      { label: 'Workshops', href: '/dashboard/workshops' },
      { label: t, href: `/dashboard/workshops/${id}` },
      { label: 'Notifications' },
    ]);
  }, [workshop, id, setPage]);

  function handleSent() {
    loadHistory(filterScope);
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto grid grid-cols-[3fr_2fr] gap-6">
        <div className="h-96 bg-white rounded-xl border border-border-gray animate-pulse" />
        <div className="h-96 bg-white rounded-xl border border-border-gray animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
          {/* Compose — 60% */}
          <ComposeSection
            workshopId={id}
            sessions={sessions}
            isOwnerAdmin={isOwnerAdmin}
            onSent={handleSent}
          />

          {/* History — 40% */}
          <HistorySection
            notifications={history}
            filterScope={filterScope}
            onFilterChange={setFilterScope}
            loading={historyLoading}
            onView={(n) => setSelectedNotification(n)}
          />
        </div>
      </div>

      <NotificationDetailSlideOver
        notification={selectedNotification}
        workshopId={id}
        onClose={() => setSelectedNotification(null)}
      />
    </>
  );
}
