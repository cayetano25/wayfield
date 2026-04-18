'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Bell, AlertCircle, Info, Clock, ChevronDown, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { NotificationDetailSlideOver, SlideOverNotification } from '@/components/notifications/NotificationDetailSlideOver';

/* --- Types ----------------------------------------------------------- */

type NotificationType = 'informational' | 'urgent' | 'reminder';
type DeliveryScope = 'all_participants' | 'leaders' | 'session_participants' | 'custom';

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
  session_id: number | null;
  session_title?: string | null;
  recipient_count: number | null;
  sent_at: string | null;
  sent_by?: { first_name: string; last_name: string } | null;
  created_at: string;
}

/* --- Constants -------------------------------------------------------- */

const MAX_MESSAGE = 500;
const OWNER_ADMIN_ROLES = ['owner', 'admin'] as const;

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
  all_participants:   'All Participants',
  leaders:            'Leaders Only',
  session_participants: 'Session Participants',
  custom:             'Custom',
};

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
  onSent: (notification: SentNotification) => void;
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

      const result = await apiPost<SentNotification>(
        `/workshops/${workshopId}/notifications`,
        body,
      );

      toast.success('Notification queued for delivery');
      onSent(result);

      // Reset form
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
        {/* Title */}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          error={titleError}
        />

        {/* Message with char count */}
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

        {/* Notification type */}
        <TypePillToggle value={notifType} onChange={setNotifType} />

        {/* Delivery scope */}
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

        {/* Session selector — animated reveal */}
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

        {/* Submit */}
        <div className="pt-1">
          <Button type="submit" variant="primary" size="md" loading={sending} className="w-full">
            Send Notification
          </Button>
        </div>
      </form>
    </div>
  );
}

/* --- History section -------------------------------------------------- */

function HistorySection({
  notifications,
  onView,
}: {
  notifications: SentNotification[];
  onView: (n: SentNotification) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-border-gray overflow-hidden">
      <div className="px-5 py-4 border-b border-border-gray">
        <h2 className="font-heading text-base font-semibold text-dark">History</h2>
      </div>

      {notifications.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-3">
            <Bell className="w-5 h-5 text-light-gray" />
          </div>
          <p className="text-sm text-medium-gray">No notifications sent yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-gray bg-surface">
                <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                  Title
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
              {notifications.map((n, index) => (
                <tr key={`notification-${n.id}-${index}`} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 max-w-[160px]">
                    <button
                      type="button"
                      onClick={() => onView(n)}
                      className="block truncate font-medium text-dark hover:text-primary transition-colors text-left w-full"
                      title={n.title}
                    >
                      {n.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={n.notification_type} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-medium-gray text-xs">
                    {scopeLabels[n.delivery_scope] ?? n.delivery_scope}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-medium-gray text-xs">
                    {n.sent_at
                      ? formatDistanceToNow(new Date(n.sent_at), { addSuffix: true })
                      : <span className="text-light-gray italic">Queued</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-medium-gray text-xs tabular-nums">
                    {n.recipient_count ?? '—'}
                  </td>
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
              ))}
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
  const [selectedNotification, setSelectedNotification] = useState<SlideOverNotification | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [wRes, sRes, nRes] = await Promise.all([
          apiGet<Workshop>(`/workshops/${id}`),
          apiGet<Session[]>(`/workshops/${id}/sessions`),
          apiGet<SentNotification[]>(`/workshops/${id}/notifications`).catch(() => []),
        ]);
        setWorkshop(wRes);
        setSessions((sRes ?? []).filter((s) => s.is_published));
        const raw = nRes ?? [];
        const unique = Array.from(
          new Map(raw.map((n: SentNotification) => [n.id, n])).values()
        );
        setHistory(unique);
      } catch {
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  useEffect(() => {
    const t = workshop?.title ?? 'Workshop';
    setPage(t, [
      { label: 'Workshops', href: '/workshops' },
      { label: t, href: `/workshops/${id}` },
      { label: 'Notifications' },
    ]);
  }, [workshop, id, setPage]);

  function handleSent(notification: SentNotification) {
    setHistory((prev) => {
      const merged = [notification, ...prev];
      return Array.from(new Map(merged.map((n) => [n.id, n])).values());
    });
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
