'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, X, Globe, Phone, UserCheck, ChevronDown, SendHorizonal,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPost, apiDelete, apiPatch, ApiError } from '@/lib/api/client';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { AddressForm } from '@/components/ui/AddressForm';
import type { AddressFormData } from '@/lib/types/address';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Workshop {
  id: number;
  title: string;
  timezone: string;
  organization_id: number;
}

interface AssignedSession {
  id: number;
  title: string;
  start_at: string;
  role_label: string | null;
}

type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'removed';

interface Leader {
  id: number; // negative when invitation has no linked leader record yet (pending-only)
  first_name: string;
  last_name: string;
  display_name: string | null;
  profile_image_url: string | null;
  bio: string | null;
  website_url: string | null;
  // phone_number is included here — organizer-level view only. Never exposed on public pages.
  phone_number: string | null;
  city: string | null;
  state_or_region: string | null;
  address?: AddressFormData | null;
  invited_email?: string | null; // present for pending invitations without a linked leader
  invitation_status: InvitationStatus;
  invitation_id: number | null;
  invitation_created_at: string | null;
  sessions_count: number;
  assigned_sessions?: AssignedSession[];
}

interface Session {
  id: number;
  title: string;
  start_at: string;
}

/* ─── Invitation status badge ────────────────────────────────────────── */

const statusBadgeClasses: Record<InvitationStatus, string> = {
  pending:  'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-danger/10 text-danger',
  expired:  'bg-surface text-light-gray',
  removed:  'bg-surface text-light-gray',
};

function InviteStatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClasses[status]}`}
    >
      {status}
    </span>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────────── */

function LeaderAvatar({
  leader,
  size = 'md',
}: {
  leader: Pick<Leader, 'first_name' | 'last_name' | 'profile_image_url'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = (`${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`).toUpperCase() || '?';
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  if (leader.profile_image_url) {
    return (
      <img
        src={leader.profile_image_url}
        alt={`${leader.first_name} ${leader.last_name}`}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}

/* ─── Leader card (grid item) ────────────────────────────────────────── */

function LeaderCard({
  leader,
  onView,
}: {
  leader: Leader;
  onView: () => void;
}) {
  const location = [leader.city, leader.state_or_region].filter(Boolean).join(', ');
  const sessionCount = (leader.assigned_sessions ?? []).length;
  const displayName = `${leader.first_name} ${leader.last_name}`.trim() || leader.invited_email || 'Invited Leader';

  return (
    <div className="bg-white rounded-xl border border-border-gray p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <LeaderAvatar leader={leader} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-dark text-sm leading-snug truncate">
            {displayName}
          </p>
          <p className="text-[13px] text-medium-gray mt-0.5 truncate">
            {sessionCount === 0
              ? 'Not assigned to any sessions'
              : `Leading ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <InviteStatusBadge status={leader.invitation_status} />
        {location && (
          <span className="text-xs text-medium-gray truncate">{location}</span>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={onView}
      >
        View
      </Button>
    </div>
  );
}

/* ─── Invite modal ───────────────────────────────────────────────────── */

interface InviteForm {
  invited_email: string;
  invited_first_name: string;
  invited_last_name: string;
}

const EMPTY_INVITE: InviteForm = {
  invited_email: '',
  invited_first_name: '',
  invited_last_name: '',
};

function InviteModal({
  open,
  orgId,
  workshopId,
  onClose,
  onInvited,
}: {
  open: boolean;
  orgId: number;
  workshopId: number;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [form, setForm] = useState<InviteForm>(EMPTY_INVITE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_INVITE);
      setErrors({});
      setSuccess(false);
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [open]);

  function setF<K extends keyof InviteForm>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!form.invited_email.trim()) e2.invited_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.invited_email)) {
      e2.invited_email = 'Enter a valid email address';
    }
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    setSaving(true);
    try {
      await apiPost(`/organizations/${orgId}/leaders/invitations`, {
        invited_email: form.invited_email.trim(),
        invited_first_name: form.invited_first_name.trim() || null,
        invited_last_name: form.invited_last_name.trim() || null,
        workshop_id: workshopId,
      });
      setSuccess(true);
      onInvited();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(mapped);
      } else {
        toast.error('Failed to send invitation');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Leader"
      size="sm"
      footer={
        success ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button form="invite-form" type="submit" loading={saving}>
              Send Invitation
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center text-center py-4 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="font-heading font-semibold text-dark">Invitation sent</p>
            <p className="text-sm text-medium-gray mt-1">
              We emailed an invitation link to{' '}
              <span className="font-medium text-dark">{form.invited_email}</span>.
            </p>
          </div>
        </div>
      ) : (
        <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={emailRef}
            label="Email"
            type="email"
            value={form.invited_email}
            onChange={(e) => setF('invited_email', e.target.value)}
            placeholder="leader@example.com"
            error={errors.invited_email}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.invited_first_name}
              onChange={(e) => setF('invited_first_name', e.target.value)}
              placeholder="They'll fill this in"
            />
            <Input
              label="Last Name"
              value={form.invited_last_name}
              onChange={(e) => setF('invited_last_name', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="rounded-lg bg-surface border border-border-gray px-4 py-3 text-xs text-medium-gray leading-relaxed">
            The leader completes their own profile after accepting — you only need their email to get started.
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ─── Session assignment selector ────────────────────────────────────── */

function SessionAssignSelector({
  sessions,
  assignedSessionIds,
  onAssign,
}: {
  sessions: Session[];
  assignedSessionIds: Set<number>;
  onAssign: (sessionId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = sessions.filter((s) => !assignedSessionIds.has(s.id));

  if (available.length === 0) {
    return (
      <p className="text-xs text-light-gray italic">All sessions already assigned</p>
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
        Assign to Session
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-6 z-20 w-72 bg-white border border-border-gray rounded-lg shadow-lg overflow-hidden">
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onAssign(s.id); setOpen(false); }}
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

/* ─── Leader slide-over ──────────────────────────────────────────────── */

function LeaderSlideOver({
  open,
  leader,
  sessions,
  workshop,
  onClose,
  onUpdated,
}: {
  open: boolean;
  leader: Leader | null;
  sessions: Session[];
  workshop: Workshop | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [resending, setResending] = useState(false);
  const [leaderAddress, setLeaderAddress] = useState<AddressFormData | null>(
    leader?.address ?? null,
  );
  const [savingAddress, setSavingAddress] = useState(false);

  // Sync address when leader changes
  useEffect(() => {
    setLeaderAddress(leader?.address ?? null);
  }, [leader?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveAddress() {
    if (!leader) return;
    setSavingAddress(true);
    try {
      await apiPatch(`/leaders/${leader.id}`, { address: leaderAddress });
      toast.success('Address saved');
      onUpdated();
    } catch {
      toast.error('Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleAssign(sessionId: number) {
    if (!leader) return;
    setAssigning(true);
    try {
      await apiPost(`/sessions/${sessionId}/leaders`, { leader_id: leader.id });
      toast.success('Assigned to session');
      onUpdated();
    } catch {
      toast.error('Failed to assign leader');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveSession(sessionId: number) {
    if (!leader) return;
    if (!confirm('Remove this leader from the session?')) return;
    try {
      await apiDelete(`/sessions/${sessionId}/leaders/${leader.id}`);
      toast.success('Removed from session');
      onUpdated();
    } catch {
      toast.error('Failed to remove leader');
    }
  }

  async function handleResendInvitation() {
    if (!leader?.invitation_id) return;
    setResending(true);
    try {
      // Resend by creating a new invitation for the same leader
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResending(false);
    }
  }

  // Negative id means a pending invitation with no linked leader record yet.
  // Profile editing, address, and session assignment don't apply until the invitation is accepted.
  const isPendingOnly = !!leader && leader.id < 0;

  const assignedSessionIds = new Set((leader?.assigned_sessions ?? []).map((s) => s.id));
  const timezone = workshop?.timezone ?? 'UTC';

  function formatSessionTime(utcStr: string): string {
    try {
      return formatInTimeZone(new Date(utcStr), timezone, 'MMM d · h:mm a');
    } catch {
      return '';
    }
  }

  const fullName = leader
    ? `${leader.first_name} ${leader.last_name}`.trim()
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
          flex flex-col
          w-full sm:w-[480px]
          transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-gray shrink-0">
          <h2 className="font-heading text-base font-semibold text-dark">Leader Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-light-gray hover:text-dark hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {leader && (
          <div className="flex-1 overflow-y-auto">
            {/* Profile header */}
            <div className="px-6 py-5 border-b border-border-gray">
              <div className="flex items-start gap-4">
                {!isPendingOnly && (
                  <div className="shrink-0">
                    <ImageUploader
                      currentUrl={leader.profile_image_url}
                      entityType="leader"
                      entityId={leader.id}
                      fieldName="profile_image_url"
                      shape="circle"
                      width={80}
                      height={80}
                      onUploadComplete={(url) => onUpdated()}
                      onRemove={async () => {
                        await apiPatch(`/leaders/${leader.id}`, { profile_image_url: null });
                        onUpdated();
                      }}
                    />
                  </div>
                )}
                {isPendingOnly && <LeaderAvatar leader={leader} size="lg" />}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="font-heading font-semibold text-dark text-base leading-snug">
                    {fullName || leader.invited_email || 'Invited Leader'}
                  </h3>
                  {leader.invited_email && !fullName && (
                    <p className="text-sm text-medium-gray mt-0.5">Pending invitation</p>
                  )}
                  {leader.display_name && (
                    <p className="text-sm text-medium-gray mt-0.5">{leader.display_name}</p>
                  )}
                  {(leader.city || leader.state_or_region) && (
                    <p className="text-sm text-medium-gray mt-1">
                      {[leader.city, leader.state_or_region].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="mt-2">
                    <InviteStatusBadge status={leader.invitation_status} />
                  </div>
                </div>
              </div>

              {/* Email shown for pending-only invitations (no linked profile yet) */}
              {isPendingOnly && leader.invited_email && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-medium-gray shrink-0">Invited:</span>
                  <span className="text-sm text-dark">{leader.invited_email}</span>
                </div>
              )}

              {/* Contact — phone visible to organizers; email/address never rendered */}
              {!isPendingOnly && leader.phone_number && (
                <div className="flex items-center gap-2 mt-4">
                  <Phone className="w-3.5 h-3.5 text-medium-gray shrink-0" />
                  <span className="text-sm text-dark">{leader.phone_number}</span>
                </div>
              )}

              {leader.website_url && (
                <div className="flex items-center gap-2 mt-2">
                  <Globe className="w-3.5 h-3.5 text-medium-gray shrink-0" />
                  <a
                    href={leader.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {leader.website_url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              {/* Resend invitation */}
              {leader.invitation_status === 'pending' && (
                <div className="mt-4 pt-4 border-t border-border-gray">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={resending}
                    onClick={handleResendInvitation}
                  >
                    <SendHorizonal className="w-3.5 h-3.5" />
                    Resend Invitation
                  </Button>
                  {leader.invitation_created_at && (
                    <p className="text-xs text-light-gray mt-1.5">
                      Invited{' '}
                      {formatInTimeZone(
                        new Date(leader.invitation_created_at),
                        timezone,
                        'MMM d, yyyy',
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bio */}
            {!isPendingOnly && leader.bio && (
              <div className="px-6 py-5 border-b border-border-gray">
                <p className="text-xs font-medium text-medium-gray uppercase tracking-wide mb-2">Bio</p>
                <p className="text-sm text-dark leading-relaxed">{leader.bio}</p>
              </div>
            )}

            {/* Address (private) — only for accepted leaders with a real record */}
            {!isPendingOnly && (
              <div className="px-6 py-5 border-b border-border-gray">
                <p className="text-xs font-medium text-medium-gray uppercase tracking-wide mb-3">Address</p>
                <AddressForm
                  value={leaderAddress}
                  onChange={setLeaderAddress}
                  defaultCountryCode={leaderAddress?.country_code ?? 'US'}
                  privacyNote="Leader address is private and never shown to participants."
                />
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={savingAddress}
                    onClick={handleSaveAddress}
                  >
                    Save Address
                  </Button>
                </div>
              </div>
            )}

            {/* Assigned sessions — only for accepted leaders */}
            {!isPendingOnly && (
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-medium-gray uppercase tracking-wide">
                  Assigned Sessions
                </p>
                {assigning && (
                  <span className="text-xs text-medium-gray">Saving…</span>
                )}
              </div>

              {(leader.assigned_sessions ?? []).length === 0 ? (
                <p className="text-sm text-light-gray mb-3">
                  Not assigned to any sessions yet.
                </p>
              ) : (
                <div className="space-y-2 mb-3">
                  {(leader.assigned_sessions ?? []).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border-gray bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark truncate">{s.title}</p>
                        <p className="text-xs text-medium-gray">{formatSessionTime(s.start_at)}</p>
                        {s.role_label && (
                          <p className="text-xs text-primary mt-0.5">{s.role_label}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSession(s.id)}
                        className="p-1 rounded text-light-gray hover:text-danger hover:bg-danger/5 transition-colors shrink-0"
                        title="Remove from session"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <SessionAssignSelector
                sessions={sessions}
                assignedSessionIds={assignedSessionIds}
                onAssign={handleAssign}
              />
            </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

function EmptyLeaders({ onInvite }: { onInvite: () => void }) {
  return (
    <Card className="py-20 px-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-5">
        <UserCheck className="w-7 h-7 text-light-gray" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-dark mb-2">No leaders yet</h3>
      <p className="text-sm text-medium-gray max-w-xs leading-relaxed mb-6">
        Invite leaders to this workshop. They'll receive an email and complete their own profile after accepting.
      </p>
      <Button onClick={onInvite}>
        <Plus className="w-4 h-4" />
        Invite Leader
      </Button>
    </Card>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */

export default function WorkshopLeadersPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [slideLeader, setSlideLeader] = useState<Leader | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wRes, sRes, lRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${id}`),
        apiGet<Session[]>(`/workshops/${id}/sessions`),
        apiGet<Leader[]>(`/workshops/${id}/leaders`),
      ]);
      setWorkshop(wRes);
      setSessions(sRes ?? []);
      setLeaders((lRes ?? []).map((l) => ({ ...l, assigned_sessions: l.assigned_sessions ?? [] })));
    } catch {
      toast.error('Failed to load leaders');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workshop) {
      setPage('Leaders', [
        { label: 'Workshops', href: '/workshops' },
        { label: 'Workshop', href: `/workshops/${id}` },
        { label: 'Leaders' },
      ]);
      return;
    }
    setPage(workshop.title, [
      { label: 'Workshops', href: '/workshops' },
      { label: workshop.title, href: `/workshops/${id}` },
      { label: 'Leaders' },
    ]);
  }, [workshop, id, setPage]);

  function openSlideOver(leader: Leader) {
    setSlideLeader(leader);
    setSlideOpen(true);
  }

  function handleSlideUpdated() {
    // Refresh leaders to get updated session assignment counts
    if (!workshop) return;
    apiGet<Leader[]>(`/workshops/${id}/leaders`).then((res) => {
      const updated = (res ?? []).map((l) => ({ ...l, assigned_sessions: l.assigned_sessions ?? [] }));
      setLeaders(updated);
      // Keep slide-over data in sync
      if (slideLeader) {
        const fresh = updated.find((l) => l.id === slideLeader.id);
        if (fresh) setSlideLeader(fresh);
      }
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 bg-white rounded-xl border border-border-gray animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1280px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-base font-semibold text-dark">
              Leaders
              {leaders.length > 0 && (
                <span className="ml-2 text-sm font-normal text-medium-gray">
                  ({leaders.length})
                </span>
              )}
            </h2>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4" />
            Invite Leader
          </Button>
        </div>

        {/* Grid or empty state */}
        {leaders.length === 0 ? (
          <EmptyLeaders onInvite={() => setInviteOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {leaders.map((leader) => (
              <LeaderCard
                key={leader.id}
                leader={leader}
                onView={() => openSlideOver(leader)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {workshop && (
        <InviteModal
          open={inviteOpen}
          orgId={workshop.organization_id}
          workshopId={workshop.id}
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            load();
          }}
        />
      )}

      {/* Leader detail slide-over */}
      <LeaderSlideOver
        open={slideOpen}
        leader={slideLeader}
        sessions={sessions}
        workshop={workshop}
        onClose={() => setSlideOpen(false)}
        onUpdated={handleSlideUpdated}
      />
    </>
  );
}
