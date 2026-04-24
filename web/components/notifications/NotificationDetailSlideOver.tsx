'use client';

import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Info, Clock, Users, UserCheck, MessagesSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';

/* --- Types ----------------------------------------------------------- */

export type NotificationType = 'informational' | 'urgent' | 'reminder';
export type DeliveryScope = 'all_participants' | 'leaders' | 'session_participants' | 'custom';
export type SenderScope = 'organizer' | 'leader';

export interface SlideOverNotification {
  id: number;
  workshop_id?: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  delivery_scope: DeliveryScope;
  sender_scope?: SenderScope;
  session_id: number | null;
  session_title?: string | null;
  session_start_at?: string | null;
  recipient_count: number | null;
  sent_at: string | null;
  sent_by?: { first_name: string; last_name: string } | null;
  created_at: string;
}

interface NotificationDetail {
  session_title: string | null;
  session_start_at?: string | null;
  sent_by: { first_name: string; last_name: string } | null;
  recipient_count: number;
  channel_breakdown: {
    email: number;
    push: number;
    in_app: number;
  } | null;
}

interface Props {
  notification: SlideOverNotification | null;
  workshopId: string;
  onClose: () => void;
}

/* --- Badge configs --------------------------------------------------- */

const typeBadge: Record<NotificationType, { label: string; className: string; icon: React.ReactNode }> = {
  informational: {
    label: 'Informational',
    className: 'bg-info/10 text-info border border-info/20',
    icon: <Info className="w-3 h-3" />,
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-[#E94F37]/10 text-[#E94F37] border border-[#E94F37]/20',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  reminder: {
    label: 'Reminder',
    className: 'bg-secondary/10 text-secondary border border-secondary/20',
    icon: <Clock className="w-3 h-3" />,
  },
};

const scopeBadge: Record<DeliveryScope, { label: string; icon: React.ReactNode }> = {
  all_participants:     { label: 'All Participants',      icon: <Users className="w-3 h-3" /> },
  leaders:             { label: 'Leaders',               icon: <UserCheck className="w-3 h-3" /> },
  session_participants: { label: 'Session Participants', icon: <MessagesSquare className="w-3 h-3" /> },
  custom:              { label: 'Custom',                icon: <Users className="w-3 h-3" /> },
};

/* --- Component ------------------------------------------------------- */

export function NotificationDetailSlideOver({ notification, workshopId, onClose }: Props) {
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = notification !== null;
  const isLeader = notification?.sender_scope === 'leader';

  // Fetch detail when notification changes
  useEffect(() => {
    if (!notification) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setDetailLoading(true);

    apiGet<NotificationDetail>(`/workshops/${workshopId}/notifications/${notification.id}`)
      .then((data) => setDetail(data))
      .catch(() => {/* non-critical — base data already shown */})
      .finally(() => setDetailLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id, workshopId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sentBy = detail?.sent_by ?? notification?.sent_by;
  const sessionTitle = detail?.session_title ?? notification?.session_title;
  const sessionStartAt = detail?.session_start_at ?? notification?.session_start_at;
  const recipientCount = detail?.recipient_count ?? notification?.recipient_count;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification detail"
        className={`fixed right-0 top-0 h-full w-full max-w-[480px] z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {notification && (
          <>
            {/* -- Header -------------------------------------------- */}
            <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-border-gray">
              <div className="flex flex-wrap gap-2">
                {/* Leader badge */}
                {isLeader && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                    Leader
                  </span>
                )}

                {/* Type badge */}
                {(() => {
                  const cfg = typeBadge[notification.notification_type];
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.className}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  );
                })()}

                {/* Scope badge */}
                {(() => {
                  const cfg = scopeBadge[notification.delivery_scope] ?? scopeBadge.custom;
                  const label = isLeader && sessionTitle
                    ? `Session: ${sessionTitle}`
                    : cfg.label;
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-medium-gray border border-border-gray">
                      {cfg.icon}
                      {label}
                    </span>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors ml-3 shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sent timestamp + by */}
            <div
              className="px-6 py-3 border-b border-border-gray bg-surface/40"
              style={isLeader ? { borderLeft: '3px solid #E67E22' } : undefined}
            >
              <p className="text-xs text-medium-gray">
                {notification.sent_at
                  ? <>Sent on <span className="font-medium text-dark">{format(parseISO(notification.sent_at), "MMMM d, yyyy 'at' h:mm a")}</span></>
                  : <span className="italic">Queued — not yet sent</span>}
              </p>
              {sentBy ? (
                <p className="text-xs text-medium-gray mt-0.5">
                  {isLeader ? (
                    <>
                      Leader:{' '}
                      <span className="font-medium" style={{ color: '#92400E' }}>
                        {sentBy.first_name} {sentBy.last_name}
                      </span>
                    </>
                  ) : (
                    <>
                      Sent by{' '}
                      <span className="font-medium text-dark">
                        {sentBy.first_name} {sentBy.last_name}
                      </span>
                    </>
                  )}
                </p>
              ) : detailLoading ? (
                <div className="h-3.5 w-32 bg-border-gray rounded animate-pulse mt-1" />
              ) : null}
            </div>

            {/* -- Scrollable body ------------------------------------ */}
            <div className="flex-1 overflow-y-auto">
              {/* Message */}
              <div className="px-6 py-5 border-b border-border-gray">
                <h2 className="font-heading text-[20px] font-semibold text-dark mb-3 leading-snug">
                  {notification.title}
                </h2>
                <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                  {notification.message}
                </p>
              </div>

              {/* Delivery */}
              <div className="px-6 py-5">
                <h3 className="text-xs font-semibold text-medium-gray uppercase tracking-widest mb-4">
                  Delivery
                </h3>

                <div className="space-y-3">
                  {/* Session — shown for session-scoped or leader notifications */}
                  {(notification.delivery_scope === 'session_participants' || isLeader) && (
                    <div className="flex items-start gap-2.5">
                      <MessagesSquare className="w-4 h-4 text-medium-gray mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-medium-gray">Session</p>
                        {sessionTitle ? (
                          <>
                            <p className="text-sm font-medium text-dark">{sessionTitle}</p>
                            {sessionStartAt && (
                              <p className="text-xs text-medium-gray mt-0.5">
                                {format(parseISO(sessionStartAt), "MMM d 'at' h:mm a")}
                              </p>
                            )}
                          </>
                        ) : detailLoading ? (
                          <div className="h-4 w-40 bg-border-gray rounded animate-pulse mt-1" />
                        ) : (
                          <p className="text-sm text-light-gray italic">—</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recipient count */}
                  <div className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-medium-gray mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-medium-gray">Recipients</p>
                      {recipientCount != null ? (
                        <p className="text-sm font-medium text-dark">
                          Delivered to {recipientCount} {recipientCount === 1 ? 'participant' : 'participants'}
                        </p>
                      ) : (
                        <div className="h-4 w-36 bg-border-gray rounded animate-pulse mt-1" />
                      )}
                    </div>
                  </div>

                  {/* Channel breakdown */}
                  {detailLoading && !detail?.channel_breakdown && (
                    <div className="rounded-lg border border-border-gray p-4 mt-2 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-between">
                          <div className="h-3.5 w-16 bg-border-gray rounded animate-pulse" />
                          <div className="h-3.5 w-10 bg-border-gray rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}
                  {detail?.channel_breakdown && (
                    <div className="rounded-lg border border-border-gray overflow-hidden mt-2">
                      <div className="grid grid-cols-3 divide-x divide-border-gray">
                        <ChannelStat label="Email" count={detail.channel_breakdown.email} />
                        <ChannelStat label="Push" count={detail.channel_breakdown.push} />
                        <ChannelStat label="In-app" count={detail.channel_breakdown.in_app} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* -- Footer -------------------------------------------- */}
            <div className="px-6 py-4 border-t border-border-gray">
              <Button variant="ghost" size="md" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ChannelStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center py-3 px-2 bg-surface/50">
      <span className="text-sm font-semibold text-dark tabular-nums">{count}</span>
      <span className="text-[10px] text-medium-gray mt-0.5">{label}</span>
    </div>
  );
}
