'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Search, X, Plus, ChevronDown } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPost, apiDelete, ApiError } from '@/lib/api/client';
import { getWorkshopParticipants } from '@/lib/api/workshops';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/* --- Types ------------------------------------------------------------ */

interface Workshop {
  id: number;
  title: string;
  timezone: string;
  organization_id: number;
  join_code: string;
}

interface Session {
  id: number;
  title: string;
  start_at: string;
  capacity: number | null;
}

interface SelectedSession {
  id: number;
  title: string;
  start_at: string;
}

type RegistrationStatus = 'confirmed' | 'pending' | 'cancelled';

interface Participant {
  registration_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  registration_status: RegistrationStatus;
  registered_at: string;
  sessions_count: number;
  sessions: SelectedSession[];
}

/* --- Constants -------------------------------------------------------- */

const regStatusClasses: Record<RegistrationStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-danger/10 text-danger',
};

/* --- Avatar ----------------------------------------------------------- */

function ParticipantAvatar({ first_name, last_name }: { first_name: string; last_name: string }) {
  const initials = `${first_name[0] ?? ''}${last_name[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 select-none">
      {initials}
    </div>
  );
}

/* --- Registration status badge ---------------------------------------- */

function RegStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${regStatusClasses[status]}`}>
      {status}
    </span>
  );
}

/* --- Remove session confirmation modal -------------------------------- */

interface RemoveSessionTarget {
  workshopId: number;
  sessionId: number;
  sessionTitle: string;
  userId: number;
  participantName: string;
}

function RemoveSessionModal({
  target,
  onClose,
  onConfirmed,
}: {
  target: RemoveSessionTarget | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleConfirm() {
    if (!target) return;
    setRemoving(true);
    try {
      await apiDelete(
        `/workshops/${target.workshopId}/sessions/${target.sessionId}/participants/${target.userId}`,
      );
      toast.success(`${target.participantName} removed from ${target.sessionTitle}`);
      onConfirmed();
    } catch {
      toast.error('Failed to remove participant from session');
    } finally {
      setRemoving(false);
      onClose();
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Remove from Session"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={removing}>Cancel</Button>
          <Button variant="danger" loading={removing} onClick={handleConfirm}>
            Remove
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-3">
          <p className="text-sm text-dark">
            Remove{' '}
            <span className="font-semibold">{target.participantName}</span> from{' '}
            <span className="font-semibold">{target.sessionTitle}</span>?
          </p>
          <p className="text-sm text-medium-gray leading-relaxed">
            This will cancel their session selection. If they are checked in, their
            attendance will also be reset.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* --- Session add selector --------------------------------------------- */

function SessionAddSelector({
  sessions,
  selectedSessionIds,
  onAdd,
}: {
  sessions: Session[];
  selectedSessionIds: Set<number>;
  onAdd: (session: Session) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = sessions.filter((s) => !selectedSessionIds.has(s.id));

  if (available.length === 0) {
    return (
      <p className="text-xs text-light-gray italic">Enrolled in all sessions</p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add to Session
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-72 bg-white border border-border-gray rounded-lg shadow-lg overflow-hidden">
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onAdd(s); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-surface transition-colors border-b border-border-gray last:border-b-0"
              >
                {s.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --- Participant slide-over ------------------------------------------- */

function ParticipantSlideOver({
  open,
  participant,
  workshop,
  sessions,
  showPhone,
  onClose,
  onRemoveSession,
  onAddToSession,
}: {
  open: boolean;
  participant: Participant | null;
  workshop: Workshop | null;
  sessions: Session[];
  showPhone: boolean;
  onClose: () => void;
  onRemoveSession: (target: RemoveSessionTarget) => void;
  onAddToSession: (participant: Participant, session: Session) => void;
}) {
  const timezone = workshop?.timezone ?? 'UTC';

  function formatDate(utcStr: string): string {
    try {
      return formatInTimeZone(new Date(utcStr), timezone, 'MMM d, yyyy · h:mm a');
    } catch {
      return utcStr;
    }
  }

  const fullName = participant
    ? `${participant.first_name} ${participant.last_name}`.trim()
    : '';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-dark/30 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full z-50 bg-white shadow-2xl
          flex flex-col w-full sm:w-[480px]
          transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-gray shrink-0">
          <h2 className="font-heading text-base font-semibold text-dark">Participant Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-light-gray hover:text-dark hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {participant && workshop && (
          <div className="flex-1 overflow-y-auto">
            {/* Profile */}
            <div className="px-6 py-5 border-b border-border-gray">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-semibold text-lg flex items-center justify-center shrink-0 select-none">
                  {`${participant.first_name[0] ?? ''}${participant.last_name[0] ?? ''}`.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-dark text-base">{fullName}</h3>
                  <p className="text-sm text-medium-gray truncate">{participant.email}</p>
                  {showPhone && participant.phone_number && (
                    <p className="text-sm text-medium-gray mt-0.5">{participant.phone_number}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-medium-gray">Registration</span>
                  <RegStatusBadge status={participant.registration_status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-medium-gray">Registered</span>
                  <span className="text-dark font-medium">{formatDate(participant.registered_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-medium-gray">Sessions selected</span>
                  <span className="text-dark font-medium">{participant.sessions_count}</span>
                </div>
              </div>
            </div>

            {/* Selected sessions */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-medium-gray uppercase tracking-wide">
                  Selected Sessions
                </p>
              </div>

              {(participant.sessions ?? []).length === 0 ? (
                <p className="text-sm text-light-gray mb-3">No sessions selected.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {(participant.sessions ?? []).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border-gray bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark truncate">{session.title}</p>
                        <p className="text-xs text-medium-gray">
                          {formatInTimeZone(new Date(session.start_at), timezone, 'MMM d · h:mm a')}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Remove from this session"
                        onClick={() =>
                          onRemoveSession({
                            workshopId: workshop.id,
                            sessionId: session.id,
                            sessionTitle: session.title,
                            userId: participant.user_id,
                            participantName: fullName,
                          })
                        }
                        className="p-1 rounded text-light-gray hover:text-danger hover:bg-danger/5 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <SessionAddSelector
                sessions={sessions}
                selectedSessionIds={new Set((participant.sessions ?? []).map((s) => s.id))}
                onAdd={(session) => onAddToSession(participant, session)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* --- Empty state ------------------------------------------------------ */

function EmptyParticipants() {
  return (
    <Card className="py-20 px-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-5">
        <Search className="w-7 h-7 text-light-gray" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-dark mb-2">No participants yet</h3>
      <p className="text-sm text-medium-gray max-w-xs leading-relaxed">
        Participants appear here after joining the workshop using the join code.
      </p>
    </Card>
  );
}

/* --- Main page -------------------------------------------------------- */

export default function WorkshopParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [slideOpen, setSlideOpen] = useState(false);
  const [slideParticipant, setSlideParticipant] = useState<Participant | null>(null);

  const [removeTarget, setRemoveTarget] = useState<RemoveSessionTarget | null>(null);

  // Phone column is shown only when the API includes the field (omitted for billing_admin)
  const showPhone = participants.length > 0 && 'phone_number' in participants[0];

  const load = useCallback(async () => {
    try {
      const [wRes, pRes, sRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${id}`),
        getWorkshopParticipants(Number(id)) as Promise<Participant[]>,
        apiGet<Session[]>(`/workshops/${id}/sessions`),
      ]);
      setWorkshop(wRes);
      setSessions(sRes ?? []);
      const normalized = ((pRes as Participant[]) ?? []).map((p) => ({
        ...p,
        sessions: p.sessions ?? [],
        sessions_count: p.sessions_count ?? 0,
      }));
      setParticipants(normalized);
    } catch {
      toast.error('Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const title = workshop?.title ?? 'Workshop';
    setPage(title, [
      { label: 'Workshops', href: '/workshops' },
      { label: title, href: `/workshops/${id}` },
      { label: 'Participants' },
    ]);
  }, [workshop, id, setPage]);

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });

  function openSlide(p: Participant) {
    setSlideParticipant(p);
    setSlideOpen(true);
  }

  function handleRemoveConfirmed() {
    load();
    // Refresh the slide-over if it's showing the affected participant
    if (slideParticipant && removeTarget && slideParticipant.user_id === removeTarget.userId) {
      (getWorkshopParticipants(Number(id)) as Promise<Participant[]>).then((res) => {
        const fresh = (res ?? []).find((p) => p.user_id === slideParticipant.user_id);
        if (fresh) setSlideParticipant({ ...fresh, sessions: fresh.sessions ?? [], sessions_count: fresh.sessions_count ?? 0 });
      }).catch(() => {});
    }
    setRemoveTarget(null);
  }

  async function handleAddToSession(participant: Participant, session: Session) {
    if (!workshop) return;
    try {
      await apiPost(`/workshops/${workshop.id}/sessions/${session.id}/participants`, {
        user_id: participant.user_id,
      });
      toast.success(`${participant.first_name} ${participant.last_name} added to ${session.title}`);
      // Refresh participants and update the slide-over
      const res = await (getWorkshopParticipants(Number(id)) as Promise<Participant[]>);
      const normalized = (res ?? []).map((p) => ({
        ...p,
        sessions: p.sessions ?? [],
        sessions_count: p.sessions_count ?? 0,
      }));
      setParticipants(normalized);
      const fresh = normalized.find((p) => p.user_id === participant.user_id);
      if (fresh) setSlideParticipant(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const msg = (err.message ?? '').toLowerCase();
        if (msg.includes('capacity')) {
          toast.error('This session is at full capacity.');
        } else if (msg.includes('already')) {
          toast.error('Participant is already enrolled in this session.');
        } else {
          toast.error(err.message || 'Could not add participant to session.');
        }
      } else {
        toast.error('Failed to add participant to session.');
      }
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-3">
        <div className="h-10 w-72 bg-white rounded-lg border border-border-gray animate-pulse" />
        <div className="h-64 bg-white rounded-xl border border-border-gray animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1280px] mx-auto">
        {/* Search */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-gray pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-light-gray"
            />
          </div>
          <span className="text-sm text-medium-gray">
            {filtered.length} participant{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Content */}
        {participants.length === 0 ? (
          <EmptyParticipants />
        ) : filtered.length === 0 ? (
          <Card className="py-16 px-8 flex flex-col items-center text-center">
            <p className="text-sm text-medium-gray">No participants match &ldquo;{search}&rdquo;</p>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-border-gray overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border-gray bg-surface">
                  <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide sticky left-0 bg-surface">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                    Email
                  </th>
                  {showPhone && (
                    <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                      Phone
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                    Sessions
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-gray">
                {filtered.map((p) => (
                  <tr
                    key={p.registration_id}
                    onClick={() => openSlide(p)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="flex items-center gap-3">
                        <ParticipantAvatar first_name={p.first_name} last_name={p.last_name} />
                        <span className="font-medium text-dark whitespace-nowrap">
                          {p.first_name} {p.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-medium-gray">{p.email}</td>
                    {showPhone && (
                      <td className="px-4 py-3 text-medium-gray">
                        {p.phone_number ?? <span className="text-light-gray">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <RegStatusBadge status={p.registration_status} />
                    </td>
                    <td className="px-4 py-3 text-medium-gray">
                      {p.sessions_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-medium-gray">
                      {workshop
                        ? formatInTimeZone(new Date(p.registered_at), workshop.timezone, 'MMM d, yyyy')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Participant slide-over */}
      <ParticipantSlideOver
        open={slideOpen}
        participant={slideParticipant}
        workshop={workshop}
        sessions={sessions}
        showPhone={showPhone}
        onClose={() => setSlideOpen(false)}
        onRemoveSession={(target) => setRemoveTarget(target)}
        onAddToSession={handleAddToSession}
      />

      {/* Remove session confirm modal */}
      <RemoveSessionModal
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirmed={handleRemoveConfirmed}
      />
    </>
  );
}
