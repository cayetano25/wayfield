'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays, Clock, MapPin, Monitor, Layers, Users,
  Infinity, ArrowLeft, UserPlus, Trash2, Phone,
} from 'lucide-react';
import { SessionLocationDisplay } from '@/components/sessions/SessionLocationDisplay';
import { SessionLeaderCard } from '@/components/sessions/SessionLeaderCard';
import type { SessionLocationResponse } from '@/lib/types/session-location';
import type { SessionLeader } from '@/lib/types/leader';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AssignParticipantModal } from '@/components/participants/AssignParticipantModal';
import { RemoveParticipantModal } from '@/components/participants/RemoveParticipantModal';
import type { RemoveParticipantTarget } from '@/components/participants/RemoveParticipantModal';

/* --- Types ---------------------------------------------------------------- */

type PublicationStatus = 'draft' | 'published' | 'archived' | 'cancelled';
type EnrollmentMode = 'self_select' | 'organizer_assign_only';

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
  publication_status?: PublicationStatus;
  session_type?: 'standard' | 'addon' | 'private' | 'vip' | 'makeup_session';
  participant_visibility?: 'visible' | 'hidden' | 'invite_only';
  enrollment_mode?: EnrollmentMode;
  track_id: number | null;
  location: SessionLocationResponse | null;
  leaders: SessionLeader[];
}

type AssignmentSource =
  | 'self_selected'
  | 'organizer_assigned'
  | 'invite_accepted'
  | 'waitlist_promoted'
  | 'addon_purchase';

type CheckInStatus = 'not_checked_in' | 'checked_in' | 'no_show';

interface AssignedParticipant {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  assignment_source: AssignmentSource;
  assigned_at: string | null;
  assignment_notes: string | null;
  assigned_by_user_id: number | null;
  check_in_status: CheckInStatus;
}

/* --- Helpers -------------------------------------------------------------- */

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

const checkInClasses: Record<CheckInStatus, string> = {
  not_checked_in: 'bg-surface text-medium-gray',
  checked_in:     'bg-emerald-100 text-emerald-700',
  no_show:        'bg-danger/10 text-danger',
};

const checkInLabels: Record<CheckInStatus, string> = {
  not_checked_in: 'Pending',
  checked_in:     'Checked In',
  no_show:        'No Show',
};

const assignmentSourceClasses: Record<AssignmentSource, string> = {
  self_selected:      'bg-surface text-medium-gray',
  organizer_assigned: 'bg-info/10 text-info',
  invite_accepted:    'bg-primary/10 text-primary',
  waitlist_promoted:  'bg-amber-100 text-amber-700',
  addon_purchase:     'bg-emerald-100 text-emerald-700',
};

const assignmentSourceLabels: Record<AssignmentSource, string> = {
  self_selected:      'Self-selected',
  organizer_assigned: 'Organizer assigned',
  invite_accepted:    'Invite accepted',
  waitlist_promoted:  'Waitlist',
  addon_purchase:     'Purchase',
};

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function formatAssignedAt(utcStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(utcStr), tz, "MMM d 'at' h:mm a");
  } catch {
    return '';
  }
}

function resolvePublicationStatus(session: Session): PublicationStatus {
  return session.publication_status ?? (session.is_published ? 'published' : 'draft');
}

const PUB_STATUS_CLASSES: Record<PublicationStatus, string> = {
  draft:     'bg-surface text-medium-gray',
  published: 'bg-emerald-100 text-emerald-700',
  archived:  'bg-slate-100 text-slate-500',
  cancelled: 'bg-danger/10 text-danger',
};

/* --- Capacity bar --------------------------------------------------------- */

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = Math.min((enrolled / capacity) * 100, 100);
  const remaining = capacity - enrolled;
  const isNear = remaining <= 5;
  const isFull = remaining <= 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-medium-gray">Assigned</span>
        <span className={`font-semibold ${isFull ? 'text-danger' : isNear ? 'text-amber-600' : 'text-dark'}`}>
          {enrolled} of {capacity}
        </span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-danger' : isNear ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isFull ? (
        <p className="text-xs text-danger font-medium">Session is full</p>
      ) : (
        <p className={`text-xs ${isNear ? 'text-amber-600 font-medium' : 'text-medium-gray'}`}>
          {remaining} spot{remaining !== 1 ? 's' : ''} remaining
        </p>
      )}
    </div>
  );
}

/* --- Assigned participant row --------------------------------------------- */

function ParticipantRow({
  participant,
  timezone,
  onRemove,
}: {
  participant: AssignedParticipant;
  timezone: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-gray last:border-0">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 select-none mt-0.5">
        {getInitials(participant.first_name, participant.last_name)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-dark truncate">
              {participant.first_name} {participant.last_name}
            </p>
            <p className="text-xs text-medium-gray truncate">{participant.email}</p>
            {participant.phone_number && (
              <p className="flex items-center gap-1 text-xs text-medium-gray mt-0.5">
                <Phone className="w-3 h-3" />
                {participant.phone_number}
              </p>
            )}
          </div>
          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded text-medium-gray hover:text-danger hover:bg-danger/5 transition-colors shrink-0"
            title="Remove participant"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${assignmentSourceClasses[participant.assignment_source]}`}>
            {assignmentSourceLabels[participant.assignment_source]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${checkInClasses[participant.check_in_status]}`}>
            {checkInLabels[participant.check_in_status]}
          </span>
        </div>

        {/* Assignment metadata */}
        {participant.assigned_at && (
          <p className="text-xs text-light-gray">
            Assigned {formatAssignedAt(participant.assigned_at, timezone)}
          </p>
        )}
        {participant.assignment_notes && (
          <p className="text-xs text-medium-gray italic leading-relaxed">
            &ldquo;{participant.assignment_notes}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

/* --- Assigned participants panel ------------------------------------------ */

function AssignedParticipantsPanel({
  session,
  workshop,
  participants,
  participantsLoading,
  participantsError,
  canForceAssign,
  onRefresh,
}: {
  session: Session;
  workshop: Workshop;
  participants: AssignedParticipant[];
  participantsLoading: boolean;
  participantsError: string | null;
  canForceAssign: boolean;
  onRefresh: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveParticipantTarget | null>(null);

  const enrollmentMode = session.enrollment_mode ?? 'self_select';
  const panelTitle = enrollmentMode === 'organizer_assign_only'
    ? 'Assigned Participants'
    : 'Manage Participants';

  const assignedUserIds = participants.map((p) => p.user_id);

  return (
    <>
      <Card>
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-border-gray flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold text-dark">{panelTitle}</h2>
            {session.session_type === 'addon' && (
              <Badge variant="session-addon" />
            )}
          </div>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            Assign
          </Button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Capacity indicator */}
          {session.capacity != null ? (
            <CapacityBar enrolled={participants.length} capacity={session.capacity} />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Infinity className="w-4 h-4 text-light-gray" />
              <span className="text-medium-gray">
                Unlimited capacity ·{' '}
                <span className="font-semibold text-dark">{participants.length}</span>{' '}
                assigned
              </span>
            </div>
          )}

          {/* Participant list */}
          {participantsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-surface rounded animate-pulse" />
              ))}
            </div>
          ) : participantsError ? (
            <div className="text-center py-4">
              <p className="text-xs text-danger mb-2">{participantsError}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="text-xs text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : participants.length > 0 ? (
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              {participants.map((p) => (
                <ParticipantRow
                  key={p.user_id}
                  participant={p}
                  timezone={workshop.timezone}
                  onRemove={() =>
                    setRemoveTarget({
                      user_id: p.user_id,
                      first_name: p.first_name,
                      last_name: p.last_name,
                      email: p.email,
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Users className="w-8 h-8 text-border-gray mx-auto mb-2" />
              <p className="text-xs text-medium-gray leading-relaxed max-w-[220px] mx-auto">
                No participants assigned yet. Use the Assign button to add participants to this session.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Assign modal */}
      <AssignParticipantModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        sessionId={session.id}
        organizationId={workshop.organization_id}
        sessionTitle={session.title}
        enrollmentMode={enrollmentMode}
        capacity={session.capacity}
        assignedCount={participants.length}
        assignedUserIds={assignedUserIds}
        canForceAssign={canForceAssign}
        onSuccess={onRefresh}
      />

      {/* Remove modal */}
      <RemoveParticipantModal
        open={removeTarget !== null}
        participant={removeTarget}
        sessionId={session.id}
        onClose={() => setRemoveTarget(null)}
        onSuccess={() => {
          setRemoveTarget(null);
          onRefresh();
        }}
      />
    </>
  );
}

/* --- Main page ------------------------------------------------------------ */

export default function SessionDetailPage() {
  const { id: workshopId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const { setPage } = usePage();
  const { currentOrg } = useUser();

  const canForceAssign =
    currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [participants, setParticipants] = useState<AssignedParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const res = await apiGet<{ data: AssignedParticipant[] } | AssignedParticipant[]>(`/sessions/${sessionId}/participants`);
      const list = Array.isArray(res) ? res : (res as { data: AssignedParticipant[] }).data ?? [];
      setParticipants(list);
    } catch {
      setParticipantsError('Failed to load participants.');
    } finally {
      setParticipantsLoading(false);
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${workshopId}`),
        apiGet<Session[]>(`/workshops/${workshopId}/sessions`),
      ]);
      setWorkshop(wRes);
      const found = (sRes ?? []).find((s) => String(s.id) === String(sessionId)) ?? null;
      setSession(found);
    } catch {
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [workshopId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

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
  const pubStatus = resolvePublicationStatus(session);

  return (
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
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PUB_STATUS_CLASSES[pubStatus]}`}
            >
              {pubStatus}
            </span>
            {session.session_type === 'addon' && (
              <Badge variant="session-addon" />
            )}
            {session.participant_visibility === 'hidden' && (
              <Badge variant="session-hidden" />
            )}
            {session.enrollment_mode === 'organizer_assign_only' && (
              <Badge variant="session-assigned_only" />
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

          {/* Description */}
          {session.description && (
            <Card className="p-5">
              <h2 className="font-heading text-sm font-semibold text-dark mb-2">Description</h2>
              <p className="text-sm text-medium-gray leading-relaxed">{session.description}</p>
            </Card>
          )}

          {/* Leaders */}
          <SessionLeaderCard leaders={session.leaders ?? []} />

          {/* Location */}
          {session.location?.type && (
            <Card className="p-5 space-y-2">
              <h2 className="font-heading text-sm font-semibold text-dark">Location</h2>
              <SessionLocationDisplay location={session.location} compact={false} />
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
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

          {/* Assigned participants panel */}
          <AssignedParticipantsPanel
            session={session}
            workshop={workshop}
            participants={participants}
            participantsLoading={participantsLoading}
            participantsError={participantsError}
            canForceAssign={canForceAssign}
            onRefresh={loadParticipants}
          />
        </div>
      </div>
    </div>
  );
}
