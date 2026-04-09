'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays, Clock, MapPin, Monitor, Layers, Users,
  Infinity, ArrowLeft, UserPlus,
} from 'lucide-react';
import { SessionLocationDisplay } from '@/components/sessions/SessionLocationDisplay';
import { SessionLeaderCard } from '@/components/sessions/SessionLeaderCard';
import type { SessionLocationResponse } from '@/lib/types/session-location';
import type { SessionLeader } from '@/lib/types/leader';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddParticipantModal } from '@/components/participants/AddParticipantModal';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Workshop {
  id: number;
  title: string;
  timezone: string;
  join_code: string;
  organization_id: number;
}

interface Session {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  capacity: number | null;
  confirmed_count: number;
  is_published: boolean;
  track_id: number | null;
  location: SessionLocationResponse | null;
  leaders: SessionLeader[];
}

interface RosterEntry {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: 'not_checked_in' | 'checked_in' | 'no_show';
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const deliveryIcons = {
  in_person: MapPin,
  virtual:   Monitor,
  hybrid:    Layers,
} as const;

const deliveryLabels = {
  in_person: 'In Person',
  virtual:   'Virtual',
  hybrid:    'Hybrid',
} as const;

const statusClasses: Record<RosterEntry['status'], string> = {
  not_checked_in: 'bg-surface text-medium-gray',
  checked_in:     'bg-emerald-100 text-emerald-700',
  no_show:        'bg-danger/10 text-danger',
};

const statusLabels: Record<RosterEntry['status'], string> = {
  not_checked_in: 'Pending',
  checked_in:     'Checked In',
  no_show:        'No Show',
};

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

/* ─── Capacity bar ───────────────────────────────────────────────────── */

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = Math.min((enrolled / capacity) * 100, 100);
  const remaining = capacity - enrolled;
  const isNear = remaining <= 5;
  const isFull = remaining <= 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-medium-gray">Enrolled</span>
        <span className={`font-semibold ${isFull ? 'text-danger' : isNear ? 'text-amber-600' : 'text-dark'}`}>
          {enrolled} / {capacity}
        </span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-danger' : isNear ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isFull && (
        <p className={`text-xs ${isNear ? 'text-amber-600 font-medium' : 'text-medium-gray'}`}>
          {remaining} spot{remaining !== 1 ? 's' : ''} remaining
        </p>
      )}
      {isFull && (
        <p className="text-xs text-danger font-medium">Session is full</p>
      )}
    </div>
  );
}

/* ─── Enrolled participant row ───────────────────────────────────────── */

function EnrolledRow({ entry }: { entry: RosterEntry }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border-gray last:border-0">
      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-[11px] flex items-center justify-center shrink-0 select-none">
        {getInitials(entry.first_name, entry.last_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dark truncate">
          {entry.first_name} {entry.last_name}
        </p>
        <p className="text-xs text-medium-gray truncate">{entry.email}</p>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusClasses[entry.status]}`}>
        {statusLabels[entry.status]}
      </span>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */

export default function SessionDetailPage() {
  const { id: workshopId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wRes, sRes, rRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${workshopId}`),
        apiGet<Session[]>(`/workshops/${workshopId}/sessions`),
        apiGet<RosterEntry[]>(`/sessions/${sessionId}/roster`).catch(() => [] as RosterEntry[]),
      ]);
      setWorkshop(wRes);
      const found = (sRes ?? []).find((s) => String(s.id) === String(sessionId)) ?? null;
      setSession(found);
      setRoster(rRes ?? []);
    } catch {
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [workshopId, sessionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const workshopTitle = workshop?.title ?? 'Workshop';
    const sessionTitle = session?.title ?? 'Session';
    setPage(sessionTitle, [
      { label: 'Workshops', href: '/workshops' },
      { label: workshopTitle, href: `/workshops/${workshopId}` },
      { label: 'Sessions', href: `/workshops/${workshopId}/sessions` },
      { label: sessionTitle },
    ]);
  }, [workshop, session, workshopId, setPage]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-5">
        <div className="h-8 w-40 bg-white rounded border border-border-gray animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-64 bg-white rounded-xl border border-border-gray animate-pulse" />
          <div className="h-48 bg-white rounded-xl border border-border-gray animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session || !workshop) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 text-center">
          <p className="text-medium-gray">Session not found.</p>
          <Link href={`/workshops/${workshopId}/sessions`} className="text-xs text-primary hover:underline mt-2 inline-block">
            Back to sessions
          </Link>
        </Card>
      </div>
    );
  }

  const tz = workshop.timezone;
  const startFormatted = formatInTimeZone(new Date(session.start_at), tz, 'EEEE, MMM d · h:mm a');
  const endFormatted = formatInTimeZone(new Date(session.end_at), tz, 'h:mm a');
  const DeliveryIcon = deliveryIcons[session.delivery_type];

  return (
    <>
      <div className="max-w-[1280px] mx-auto space-y-5">
        {/* Back link */}
        <Link
          href={`/workshops/${workshopId}/sessions`}
          className="inline-flex items-center gap-1.5 text-sm text-medium-gray hover:text-dark transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Sessions
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant={`delivery-${session.delivery_type}`} />
              {session.is_published ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  Published
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-medium-gray">
                  Draft
                </span>
              )}
            </div>
            <h1 className="font-heading text-2xl font-bold text-dark leading-tight">{session.title}</h1>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column — session details */}
          <div className="lg:col-span-2 space-y-5">
            {/* Date & time card */}
            <Card className="p-5 space-y-3">
              <h2 className="font-heading text-sm font-semibold text-dark">Schedule</h2>
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4 h-4 text-medium-gray shrink-0 mt-0.5" />
                <div className="text-sm text-dark">
                  <p className="font-medium">{startFormatted}</p>
                  <p className="text-xs text-medium-gray mt-0.5">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Ends at {endFormatted} · {tz.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-border-gray">
                <DeliveryIcon className="w-4 h-4 text-medium-gray shrink-0" />
                <span className="text-sm text-dark">{deliveryLabels[session.delivery_type]}</span>
              </div>
            </Card>

            {/* Leaders */}
            <SessionLeaderCard leaders={session.leaders ?? []} />

            {/* Description */}
            {session.description && (
              <Card className="p-5">
                <h2 className="font-heading text-sm font-semibold text-dark mb-2">Description</h2>
                <p className="text-sm text-medium-gray leading-relaxed">{session.description}</p>
              </Card>
            )}

            {/* Location */}
            {session.location?.type && (
              <Card className="p-5 space-y-2">
                <h2 className="font-heading text-sm font-semibold text-dark">Location</h2>
                <SessionLocationDisplay location={session.location} compact={false} />
              </Card>
            )}
          </div>

          {/* Right column — capacity & enrollment */}
          <div className="space-y-5">
            <Card>
              <div className="px-5 py-4 border-b border-border-gray flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-dark">Capacity &amp; Enrollment</h2>
                <Users className="w-4 h-4 text-light-gray" />
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Capacity display */}
                {session.capacity != null ? (
                  <CapacityBar
                    enrolled={roster.length}
                    capacity={session.capacity}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <Infinity className="w-4 h-4 text-light-gray" />
                    <span className="text-medium-gray">
                      Unlimited capacity ·{' '}
                      <span className="font-semibold text-dark">{roster.length}</span> enrolled
                    </span>
                  </div>
                )}

                {/* Enrolled participants list */}
                {roster.length > 0 ? (
                  <div className="pt-1">
                    <p className="text-xs font-medium text-medium-gray uppercase tracking-wide mb-2">
                      Enrolled ({roster.length})
                    </p>
                    <div className="max-h-64 overflow-y-auto -mx-1 px-1">
                      {roster.map((entry) => (
                        <EnrolledRow key={entry.user_id} entry={entry} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-light-gray pt-1">No participants enrolled yet.</p>
                )}

                {/* Add Participant button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setAddParticipantOpen(true)}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Participant
                </Button>
              </div>
            </Card>

            {/* Workshop link */}
            <Card className="p-4">
              <p className="text-xs text-medium-gray mb-1">Workshop</p>
              <Link
                href={`/workshops/${workshopId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {workshop.title}
              </Link>
              <p className="text-xs text-medium-gray mt-2">
                Join code:{' '}
                <code className="font-mono font-semibold text-dark tracking-widest">
                  {workshop.join_code}
                </code>
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Participant modal */}
      <AddParticipantModal
        open={addParticipantOpen}
        onClose={() => setAddParticipantOpen(false)}
        workshopId={workshop.id}
        sessionId={session.id}
        sessionTitle={session.title}
        organizationId={workshop.organization_id}
        joinCode={workshop.join_code}
        capacity={session.capacity}
        confirmedCount={roster.length}
        onSuccess={load}
      />
    </>
  );
}
