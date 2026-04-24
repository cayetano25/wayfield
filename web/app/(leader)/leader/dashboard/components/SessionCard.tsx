'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Calendar, ChevronDown, ChevronUp, MapPin, Users } from 'lucide-react';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import toast from 'react-hot-toast';
import { apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { LeaderNotificationComposeModal } from '@/components/notifications/LeaderNotificationComposeModal';
import type { LeaderDashboardSession, RosterParticipant } from '@/lib/types/leader';

/* --- Time helpers -------------------------------------------------------- */

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatSessionDateTime(startAt: string | null, endAt: string | null, timezone: string): string {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;

  if (!start || isNaN(start.getTime())) return 'TBD';

  const tz = isValidTimezone(timezone) ? timezone : 'UTC';

  const datePart = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  }).format(start);

  const timeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  });

  const endStr = end && !isNaN(end.getTime()) ? ` – ${timeFmt.format(end)}` : '';
  return `${datePart} · ${timeFmt.format(start)}${endStr}`;
}

function formatWindowTime(isoStr: string, timezone: string): string {
  const date = new Date(isoStr);
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: tz,
  }).format(date);
}

/* --- Window state logic -------------------------------------------------- */

type WindowState = 'active' | 'not_yet_open' | 'closed' | 'no_participants';

function getWindowState(session: LeaderDashboardSession, now: Date): WindowState {
  if (session.enrolled_count === 0) return 'no_participants';
  const isOpen = session.messaging_window_open ?? session.messaging_window?.is_open ?? false;
  if (isOpen) return 'active';
  const opensAt = session.messaging_window_start ?? session.messaging_window?.opens_at ?? null;
  if (opensAt && now < new Date(opensAt)) return 'not_yet_open';
  return 'closed';
}

function getDisabledTooltip(session: LeaderDashboardSession, now: Date): string {
  const state = getWindowState(session, now);
  if (state === 'no_participants') return 'No participants enrolled in this session';
  if (state === 'not_yet_open') return 'Opens 4 hours before session starts';
  return 'Messaging window has closed for this session';
}

/* --- WindowStatusLine --------------------------------------------------- */

function WindowStatusLine({ session, now }: { session: LeaderDashboardSession; now: Date }) {
  const isOpen = session.messaging_window_open ?? session.messaging_window?.is_open ?? false;
  const tz = session.workshop_timezone ?? 'UTC';
  const opensAt = session.messaging_window_start ?? session.messaging_window?.opens_at ?? null;

  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans" style={{ fontSize: 12, color: '#0FA3B1' }}>
        <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: '#0FA3B1' }} />
        Session window open · Check-in and messaging active
      </span>
    );
  }

  if (opensAt && new Date(opensAt) > now) {
    const diffMs = new Date(opensAt).getTime() - now.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffMin = Math.floor((diffMs % 3_600_000) / 60_000);
    const timeStr = formatWindowTime(opensAt, tz);

    let durationText: string;
    if (diffH >= 24) {
      const days = Math.floor(diffH / 24);
      const remH = diffH % 24;
      durationText = remH > 0 ? `${days}d ${remH}h` : `${days}d`;
    } else if (diffH > 0) {
      durationText = diffMin > 0 ? `${diffH}h ${diffMin}m` : `${diffH}h`;
    } else {
      durationText = `${Math.max(diffMin, 1)}m`;
    }

    return (
      <span className="inline-flex items-center gap-1.5 font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
        <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, border: '1px solid #9CA3AF' }} />
        Check-in opens in {durationText} · {timeStr}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
      <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, border: '1px solid #9CA3AF' }} />
      Session window closed · Attendance is final
    </span>
  );
}

/* --- Helpers ------------------------------------------------------------ */

function stripToDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const d = stripToDigits(phone);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

/* --- ParticipantRow ----------------------------------------------------- */

interface ParticipantRowProps {
  participant: RosterParticipant;
  sessionId: number;
  messagingWindowOpen: boolean;
  onCheckedIn: (userId: number) => void;
  onNoShow: (userId: number) => void;
  onReverted: (userId: number) => void;
}

function ParticipantRow({
  participant, sessionId, messagingWindowOpen, onCheckedIn, onNoShow, onReverted,
}: ParticipantRowProps) {
  const [localStatus, setLocalStatus] = useState<RosterParticipant['attendance']['status']>(
    participant.attendance.status,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = participant;

  const handleCheckIn = async () => {
    if (submitting) return;
    const prev = localStatus;
    setLocalStatus('checked_in');
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/sessions/${sessionId}/attendance/${user.id}/leader-check-in`);
      onCheckedIn(user.id);
    } catch {
      setLocalStatus(prev);
      setError('Check-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoShow = async () => {
    if (submitting) return;
    const prev = localStatus;
    setLocalStatus('no_show');
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/sessions/${sessionId}/attendance/${user.id}/no-show`);
      onNoShow(user.id);
    } catch {
      setLocalStatus(prev);
      setError('No-show failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevert = async () => {
    if (submitting) return;
    const prev = localStatus;
    setLocalStatus('not_checked_in');
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/sessions/${sessionId}/attendance/${user.id}/revert`);
      onReverted(user.id);
    } catch {
      setLocalStatus(prev);
      setError('Revert failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const revertBtn = (
    <button
      type="button"
      onClick={handleRevert}
      disabled={submitting}
      className="font-sans font-semibold rounded transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ fontSize: 12, padding: '4px 10px', minHeight: 30, backgroundColor: 'white', color: '#6B7280', border: '1px solid #D1D5DB' }}
    >
      {submitting ? '…' : 'Revert'}
    </button>
  );

  let actions: React.ReactNode;

  if (localStatus === 'checked_in') {
    // State C — checked in, window irrelevant
    actions = (
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="font-sans font-semibold rounded-full"
          style={{ fontSize: 11, padding: '4px 12px', backgroundColor: '#D1FAE5', color: '#065F46' }}
        >
          Checked In
        </span>
        {revertBtn}
      </div>
    );
  } else if (localStatus === 'no_show') {
    // State D — no-show, window irrelevant
    actions = (
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="font-sans font-semibold rounded-full"
          style={{ fontSize: 11, padding: '4px 12px', backgroundColor: '#FEE2E2', color: '#DC2626' }}
        >
          No Show
        </span>
        {revertBtn}
      </div>
    );
  } else if (messagingWindowOpen) {
    // State A — not checked in, window open
    actions = (
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shrink-0">
        <button
          type="button"
          onClick={handleNoShow}
          disabled={submitting}
          className="font-sans font-semibold rounded-lg border border-gray-300 bg-white text-gray-500 transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: 13, padding: '8px 16px', minHeight: 44 }}
        >
          {submitting ? '…' : 'No Show'}
        </button>
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={submitting}
          className="font-sans font-semibold rounded-lg text-white transition-colors hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: 13, padding: '8px 16px', minHeight: 44, backgroundColor: '#0FA3B1' }}
        >
          {submitting ? '…' : 'Check In'}
        </button>
      </div>
    );
  } else {
    // State B — not checked in, window closed
    actions = (
      <div className="relative group flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shrink-0">
        <button
          type="button"
          disabled
          title="Available during the session window"
          className="font-sans font-semibold rounded-lg border border-gray-200 bg-white text-gray-400 opacity-50 cursor-not-allowed"
          style={{ fontSize: 13, padding: '8px 16px', minHeight: 44 }}
        >
          No Show
        </button>
        <button
          type="button"
          disabled
          title="Available during the session window"
          className="font-sans font-semibold rounded-lg bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed"
          style={{ fontSize: 13, padding: '8px 16px', minHeight: 44 }}
        >
          Check In
        </button>
        <div
          className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 pointer-events-none"
          style={{ minWidth: 220 }}
        >
          <div
            className="font-sans rounded-lg px-3 py-2"
            style={{ fontSize: 12, backgroundColor: '#1F2937', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
          >
            Available during the session window
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      style={{ padding: '12px 20px', borderBottom: '1px solid #F3F4F6', minHeight: 56 }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full font-sans font-bold"
        style={{ width: 36, height: 36, backgroundColor: '#CCF0F3', color: '#0FA3B1', fontSize: 12 }}
      >
        {initials(user.first_name, user.last_name)}
      </div>

      {/* Name + phone + inline error */}
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold" style={{ fontSize: 14, color: '#2E2E2E' }}>
          {user.first_name} {user.last_name}
        </p>
        {user.phone_number && (
          <a
            href={`tel:${stripToDigits(user.phone_number)}`}
            className="font-sans underline"
            style={{ fontSize: 13, color: '#0FA3B1', textDecorationColor: '#0FA3B1' }}
          >
            {formatPhone(user.phone_number)}
          </a>
        )}
        {error && (
          <p className="font-sans" style={{ fontSize: 12, color: '#E94F37', marginTop: 2 }}>
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions}
    </div>
  );
}

/* --- ParticipantsPanel -------------------------------------------------- */

interface ParticipantsPanelProps {
  sessionId: number;
  messagingWindowOpen: boolean;
  session: LeaderDashboardSession;
  now: Date;
}

function ParticipantsPanel({ sessionId, messagingWindowOpen, session, now }: ParticipantsPanelProps) {
  const [roster, setRoster] = useState<RosterParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError(false);
    try {
      const res = await apiGet<{ data: RosterParticipant[] }>(`/sessions/${sessionId}/roster`);
      setRoster(res.data);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loaded, sessionId]);

  useEffect(() => { load(); }, [load]);

  const handleCheckedIn = (userId: number) => {
    setRoster(prev =>
      prev
        ? prev.map(p =>
            p.user.id === userId
              ? { ...p, attendance: { ...p.attendance, status: 'checked_in' as const, checked_in_at: new Date().toISOString() } }
              : p,
          )
        : prev,
    );
  };

  const handleNoShow = (userId: number) => {
    setRoster(prev =>
      prev
        ? prev.map(p =>
            p.user.id === userId
              ? { ...p, attendance: { ...p.attendance, status: 'no_show' as const } }
              : p,
          )
        : prev,
    );
  };

  const handleReverted = (userId: number) => {
    setRoster(prev =>
      prev
        ? prev.map(p =>
            p.user.id === userId
              ? { ...p, attendance: { status: 'not_checked_in' as const, check_in_method: null, checked_in_at: null } }
              : p,
          )
        : prev,
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>Loading participants…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#E94F37' }}>
          Could not load participants.{' '}
          <button
            type="button"
            onClick={() => setLoaded(false)}
            className="underline"
            style={{ color: '#0FA3B1' }}
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!roster || roster.length === 0) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>No participants enrolled.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Window status line above the roster */}
      <div style={{ padding: '10px 20px 8px', borderBottom: '1px solid #F9FAFB' }}>
        <WindowStatusLine session={session} now={now} />
      </div>

      {roster.map(p => (
        <ParticipantRow
          key={p.user.id}
          participant={p}
          sessionId={sessionId}
          messagingWindowOpen={messagingWindowOpen}
          onCheckedIn={handleCheckedIn}
          onNoShow={handleNoShow}
          onReverted={handleReverted}
        />
      ))}
    </div>
  );
}

/* --- SessionCard -------------------------------------------------------- */

export function SessionCard({ session }: { session: LeaderDashboardSession }) {
  const [expanded, setExpanded] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = session.workshop_timezone ?? 'UTC';
  const dateTimeStr = formatSessionDateTime(session.start_at, session.end_at, tz);
  const windowState = getWindowState(session, now);
  const isWindowActive = windowState === 'active';

  const loc = session.location ?? null;
  const workshopDefaultLocationId = session.workshop_default_location_id ?? null;

  const hasName = !!(loc && loc.name && loc.name.trim());
  const hasAddressText = !!(loc && (
    (loc.address_line_1 && loc.address_line_1.trim()) ||
    (loc.city && loc.city.trim())
  ));
  const hasCoords = !!(loc && loc.latitude != null && loc.longitude != null);
  const locationPresent = loc != null && (hasName || hasAddressText || hasCoords);
  const isSameAsVenue = locationPresent && workshopDefaultLocationId != null && loc!.id === workshopDefaultLocationId;

  let mapUrl: string | null = null;
  if (hasCoords) {
    const qParam = loc!.name
      ? encodeURIComponent(loc!.name)
      : loc!.address_line_1
        ? encodeURIComponent(loc!.address_line_1)
        : null;
    mapUrl = `https://maps.apple.com/?ll=${loc!.latitude},${loc!.longitude}${qParam ? `&q=${qParam}` : ''}`;
  }

  const capacityStr =
    session.capacity !== null
      ? `${session.enrolled_count} / ${session.capacity} enrolled`
      : `${session.enrolled_count} enrolled`;

  function handleNotificationSuccess(recipientCount: number) {
    setComposeOpen(false);
    toast.success(`Notification sent to ${recipientCount} participant${recipientCount !== 1 ? 's' : ''}`);
  }

  return (
    <>
      <div
        className="bg-white overflow-hidden"
        style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {/* Card body */}
        <div style={{ padding: '20px 20px 16px' }}>
          {/* LIVE badge */}
          {session.is_live && (
            <div style={{ marginBottom: 12 }}>
              <span
                className="inline-flex items-center gap-1.5 font-sans font-semibold rounded-full"
                style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#D1FAE5', color: '#065F46' }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: '#10B981' }}
                />
                LIVE NOW
              </span>
            </div>
          )}

          {/* Workshop name */}
          <p
            className="font-sans font-semibold"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
              marginBottom: 4,
              wordBreak: 'break-word',
            }}
          >
            {session.workshop_title}
          </p>

          {/* Session title */}
          <h3
            className="font-heading font-bold leading-snug"
            style={{ fontSize: 20, color: '#2E2E2E', marginBottom: 16 }}
          >
            {session.session_title}
          </h3>

          {/* Details block */}
          <div className="flex flex-col gap-2.5">
            {/* Date + time */}
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#9CA3AF' }} />
              <span className="font-sans" style={{ fontSize: 14, color: '#4B5563' }}>
                {dateTimeStr}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#9CA3AF' }} />
              {!locationPresent ? (
                <span className="font-sans" style={{ fontSize: 14, color: '#9CA3AF' }}>
                  Location TBD
                </span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {isSameAsVenue && (
                    <p className="font-sans italic" style={{ fontSize: 12, color: '#9CA3AF' }}>
                      Same as workshop venue
                    </p>
                  )}
                  {loc!.name && (
                    <p className="font-sans font-semibold" style={{ fontSize: 14, color: '#4B5563' }}>
                      {loc!.name}
                    </p>
                  )}
                  {hasAddressText && (
                    <div className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
                      {loc!.address_line_1 && <p>{loc!.address_line_1}</p>}
                      {loc!.address_line_2 && <p>{loc!.address_line_2}</p>}
                      {[loc!.city, loc!.state_or_region, loc!.postal_code].filter(Boolean).length > 0 && (
                        <p>{[loc!.city, loc!.state_or_region, loc!.postal_code].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  )}
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sans underline hover:no-underline"
                      style={{ fontSize: 13, color: '#0FA3B1', minHeight: 44, alignItems: 'center' }}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Open in Maps
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 shrink-0" style={{ color: '#9CA3AF' }} />
              <span className="font-sans" style={{ fontSize: 14, color: '#4B5563' }}>
                {capacityStr}
              </span>
            </div>
          </div>

          {/* Description */}
          {session.description && (
            <div style={{ marginTop: 16 }}>
              <RichTextDisplay
                html={session.description}
                className="text-sm text-gray-500"
              />
            </div>
          )}
        </div>

        {/* Card footer — actions */}
        <div
          className="flex items-start justify-between flex-wrap gap-2"
          style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}
        >
          {/* Send Notification + window status line */}
          <div className="flex flex-col gap-1.5">
            <div className="relative group">
              {isWindowActive ? (
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="inline-flex items-center gap-2 font-sans font-semibold rounded-lg transition-colors hover:bg-teal-50"
                  style={{
                    fontSize: 13,
                    padding: '10px 16px',
                    minHeight: 44,
                    color: '#0FA3B1',
                    border: '1.5px solid #0FA3B1',
                    backgroundColor: 'white',
                  }}
                >
                  <Bell className="w-3.5 h-3.5" />
                  Send Notification
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    title={getDisabledTooltip(session, now)}
                    className="inline-flex items-center gap-2 font-sans font-semibold rounded-lg cursor-not-allowed opacity-50"
                    style={{
                      fontSize: 13,
                      padding: '10px 16px',
                      minHeight: 44,
                      color: '#9CA3AF',
                      border: '1.5px solid #E5E7EB',
                      backgroundColor: 'white',
                    }}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Send Notification
                  </button>
                  <div
                    className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 pointer-events-none"
                    style={{ minWidth: 230 }}
                  >
                    <div
                      className="font-sans rounded-lg px-3 py-2"
                      style={{
                        fontSize: 12,
                        backgroundColor: '#1F2937',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}
                    >
                      {getDisabledTooltip(session, now)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Window status line (footer — visible when collapsed) */}
            <WindowStatusLine session={session} now={now} />
          </div>

          {/* Participants toggle */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-2 font-sans font-semibold rounded-lg transition-colors hover:bg-gray-50"
            style={{
              fontSize: 13,
              padding: '10px 16px',
              minHeight: 44,
              color: '#0FA3B1',
              border: '1.5px solid #E5E7EB',
              backgroundColor: 'white',
            }}
          >
            {session.enrolled_count} Participants
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded participant list */}
        {expanded && (
          <div style={{ borderTop: '1px solid #F3F4F6' }}>
            <ParticipantsPanel
              sessionId={session.session_id}
              messagingWindowOpen={isWindowActive}
              session={session}
              now={now}
            />
          </div>
        )}
      </div>

      {/* Compose modal */}
      <LeaderNotificationComposeModal
        open={composeOpen}
        sessionId={session.session_id}
        sessionTitle={session.session_title}
        participantCount={session.enrolled_count}
        onClose={() => setComposeOpen(false)}
        onSuccess={handleNotificationSuccess}
      />
    </>
  );
}
