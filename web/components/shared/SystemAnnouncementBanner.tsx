'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Info, AlertTriangle, Wrench, AlertOctagon, Sparkles } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';
import { apiGet, apiPost } from '@/lib/api/client';

/* --- Types ---------------------------------------------------------------- */

type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'outage' | 'update';

interface ApiAnnouncement {
  id: number;
  title: string;
  message: string;
  announcement_type: AnnouncementType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  is_dismissable: boolean;
  ends_at: string | null;
  created_at: string;
  is_dismissed: boolean;
}

interface AnnouncementsResponse {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_ends_at: string | null;
  announcements: ApiAnnouncement[];
}

/* --- Config --------------------------------------------------------------- */

const POLL_INTERVAL_MS = 5 * 60 * 1000;

const typeConfig: Record<
  AnnouncementType,
  { bg: string; icon: React.ElementType; isSolid: boolean }
> = {
  info:        { bg: 'bg-blue-600',    icon: Info,           isSolid: false },
  warning:     { bg: 'bg-amber-500',   icon: AlertTriangle,  isSolid: false },
  maintenance: { bg: 'bg-[#E67E22]',   icon: Wrench,         isSolid: false },
  outage:      { bg: 'bg-[#E94F37]',   icon: AlertOctagon,   isSolid: true  },
  update:      { bg: 'bg-[#0FA3B1]',   icon: Sparkles,       isSolid: false },
};

export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining < 30) return 'Any moment now';
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  return `Back in ${mins}m ${String(secs).padStart(2, '0')}s`;
}

/* --- Countdown timer ------------------------------------------------------ */

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(
    () => Math.max(0, differenceInSeconds(new Date(endsAt), new Date())),
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, differenceInSeconds(new Date(endsAt), new Date())));
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining <= 0) return null;

  return (
    <span className="font-mono text-sm font-medium whitespace-nowrap">
      {formatCountdown(remaining)}
    </span>
  );
}

/* --- Maintenance banner --------------------------------------------------- */

function MaintenanceBanner({
  message,
  endsAt,
}: {
  message: string | null;
  endsAt: string | null;
}) {
  return (
    <div
      className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-[#E67E22] text-white"
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Wrench className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          {message ?? 'Wayfield is under scheduled maintenance.'}
        </span>
      </div>
      {endsAt && new Date(endsAt) > new Date() && (
        <CountdownTimer endsAt={endsAt} />
      )}
    </div>
  );
}

/* --- Announcement banner item --------------------------------------------- */

function AnnouncementItem({
  announcement,
  onDismiss,
}: {
  announcement: ApiAnnouncement;
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[announcement.announcement_type] ?? typeConfig.info;
  const Icon = cfg.icon;

  // Critical severity (or outage type) = never dismissible regardless of is_dismissable flag
  const canDismiss =
    announcement.is_dismissable &&
    announcement.severity !== 'critical' &&
    announcement.announcement_type !== 'outage';

  return (
    <div className={`w-full flex items-start gap-3 ${canDismiss ? 'py-2' : 'py-3'} px-4 ${cfg.bg} text-white`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{announcement.title}</p>
        <p
          className={`text-sm mt-0.5 opacity-90 ${!expanded && announcement.message.length > 120 ? 'line-clamp-1' : ''}`}
          title={!expanded ? announcement.message : undefined}
        >
          {announcement.message}
        </p>
        {announcement.message.length > 120 && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="text-xs underline mt-1 opacity-80 hover:opacity-100"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      {canDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(announcement.id)}
          aria-label="Dismiss announcement"
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* --- Main component ------------------------------------------------------- */

export function SystemAnnouncementBanner() {
  const [data, setData] = useState<AnnouncementsResponse | null>(null);
  const [localDismissed, setLocalDismissed] = useState<Set<number>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await apiGet<AnnouncementsResponse>('/system/announcements');
      setData(res);
    } catch {
      // Silently fail — announcement banner is non-critical
    }
  }, []);

  useEffect(() => {
    void fetchAnnouncements();
    const id = setInterval(() => void fetchAnnouncements(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAnnouncements]);

  const handleDismiss = useCallback(
    async (id: number) => {
      // Optimistic update: hide immediately
      setLocalDismissed((prev) => new Set([...prev, id]));
      try {
        await apiPost(`/system/announcements/${id}/dismiss`);
        // Refetch so server-side is_dismissed is reflected on next poll
        void fetchAnnouncements();
      } catch {
        // Fallback: persist dismissal in localStorage so it survives a page reload
        try {
          const stored: number[] = JSON.parse(
            localStorage.getItem('wf_dismissed_announcements') ?? '[]',
          );
          if (!stored.includes(id)) {
            localStorage.setItem(
              'wf_dismissed_announcements',
              JSON.stringify([...stored, id]),
            );
          }
        } catch {
          // localStorage unavailable — optimistic state is still correct for this session
        }
      }
    },
    [fetchAnnouncements],
  );

  if (!data) return null;

  // Hydrate localStorage dismissals on first render (fallback for unauthenticated or failed API dismissals)
  const storedDismissed: number[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('wf_dismissed_announcements') ?? '[]');
    } catch {
      return [];
    }
  })();

  const visibleAnnouncements = data.announcements.filter(
    (a) =>
      !a.is_dismissed &&
      !localDismissed.has(a.id) &&
      !storedDismissed.includes(a.id),
  );

  if (!data.maintenance_mode && visibleAnnouncements.length === 0) return null;

  return (
    <div className="w-full" style={{ position: 'relative', zIndex: 9999 }}>
      {data.maintenance_mode && (
        <MaintenanceBanner
          message={data.maintenance_message}
          endsAt={data.maintenance_ends_at}
        />
      )}
      {visibleAnnouncements.map((a) => (
        <AnnouncementItem key={a.id} announcement={a} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
