'use client';

// Presentation-only component. The canonical self-fetching version is SystemAnnouncementBanner.
// This component is kept for cases where announcements are pre-fetched server-side.

import { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, Wrench, AlertOctagon, Sparkles } from 'lucide-react';
import { apiPost } from '@/lib/api/client';

type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'outage' | 'update';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  announcement_type: AnnouncementType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  is_dismissable: boolean;
  is_dismissed: boolean;
  ends_at: string | null;
  created_at: string;
}

const STORAGE_KEY = 'wf_dismissed_announcements';

const typeConfig: Record<
  AnnouncementType,
  { color: string; bg: string; icon: React.ElementType; isOutage: boolean }
> = {
  info:        { color: '#7EA8BE', bg: '#7EA8BE1F', icon: Info,          isOutage: false },
  warning:     { color: '#F59E0B', bg: '#F59E0B1F', icon: AlertTriangle,  isOutage: false },
  maintenance: { color: '#E67E22', bg: '#E67E221F', icon: Wrench,         isOutage: false },
  outage:      { color: '#E94F37', bg: '#E94F37',   icon: AlertOctagon,   isOutage: true  },
  update:      { color: '#0FA3B1', bg: '#0FA3B11F', icon: Sparkles,       isOutage: false },
};

function AnnouncementBanner({
  announcement,
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[announcement.announcement_type] ?? typeConfig.info;
  const Icon = cfg.icon;

  const canDismiss =
    announcement.is_dismissable &&
    announcement.severity !== 'critical' &&
    !cfg.isOutage;

  return (
    <div
      style={{
        borderLeftColor: cfg.color,
        background: cfg.bg,
        color: cfg.isOutage ? '#ffffff' : undefined,
      }}
      className="flex items-start gap-3 px-4 py-3 border-l-4"
    >
      <Icon
        className="w-[18px] h-[18px] shrink-0 mt-0.5"
        style={{ color: cfg.isOutage ? '#ffffff' : cfg.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug">{announcement.title}</p>
        <p className={`text-sm mt-0.5 ${!expanded ? 'line-clamp-2' : ''}`}>
          {announcement.message}
        </p>
        {announcement.message.length > 120 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs underline mt-1 opacity-70 hover:opacity-100"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      {canDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(announcement.id)}
          className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" style={{ color: cfg.color }} />
        </button>
      )}
    </div>
  );
}

export function AnnouncementBannerClient({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(stored)) setDismissed(stored);
    } catch {
      // ignore
    }
  }, []);

  async function handleDismiss(id: number) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    try {
      await apiPost(`/system/announcements/${id}/dismiss`);
    } catch {
      // Best-effort — localStorage dismissal already applied
    }
  }

  const visible = announcements.filter(
    (a) => !a.is_dismissed && !dismissed.includes(a.id),
  );
  if (visible.length === 0) return null;

  return (
    <div>
      {visible.map((a) => (
        <AnnouncementBanner key={a.id} announcement={a} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
