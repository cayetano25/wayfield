'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Plus, X, Globe, Phone, UserCheck, ChevronDown, SendHorizonal,
  User as UserIcon, UserPlus, CheckCircle, Mail,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, apiDelete, ApiError } from '@/lib/api/client';
import { checkEmailExists } from '@/lib/api/invitations';
import type { AdminUser } from '@/lib/auth/session';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

/* --- Types ----------------------------------------------------------- */

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

type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'removed'
  | 'rescinded';

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
  invited_email?: string | null; // present for pending invitations without a linked leader
  invitation_status: InvitationStatus;
  invitation_id: number | null;
  invitation_created_at: string | null;
  sessions_count: number;
  assigned_sessions?: AssignedSession[];
  is_self_enrolled: boolean;
}

interface Session {
  id: number;
  title: string;
  start_at: string;
}

interface ConfirmActionState {
  type: 'rescind' | 'remove_leader' | 'remove_session' | 'remove_self';
  leader: Leader;
  session?: AssignedSession;
}

/* --- Invitation status badge ------------------------------------------ */

const statusBadgeClasses: Record<InvitationStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  accepted:  'bg-emerald-100 text-emerald-700',
  declined:  'bg-danger/10 text-danger',
  expired:   'bg-surface text-light-gray',
  removed:   'bg-surface text-light-gray',
  rescinded: 'bg-surface text-light-gray',
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

/* --- Avatar ----------------------------------------------------------- */

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
  const sizePx = { sm: 32, md: 44, lg: 64 };

  if (leader.profile_image_url) {
    return (
      <Image
        src={leader.profile_image_url}
        alt={`${leader.first_name} ${leader.last_name}`}
        width={sizePx[size]}
        height={sizePx[size]}
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

/* --- Invite modal ----------------------------------------------------- */

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
  const [emailHint, setEmailHint] = useState<'exists' | 'new' | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_INVITE);
      setErrors({});
      setSuccess(false);
      setEmailHint(null);
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleEmailBlur() {
    const trimmed = form.invited_email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailHint(null); return; }
    setEmailChecking(true);
    try {
      const exists = await checkEmailExists(trimmed);
      setEmailHint(exists ? 'exists' : 'new');
    } catch { setEmailHint(null); }
    finally { setEmailChecking(false); }
  }

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
          <div className="flex flex-col gap-1">
            <Input
              ref={emailRef}
              label="Email"
              type="email"
              value={form.invited_email}
              onChange={(e) => { setF('invited_email', e.target.value); setEmailHint(null); }}
              onBlur={handleEmailBlur}
              placeholder="leader@example.com"
              error={errors.invited_email}
            />
            {!errors.invited_email && emailChecking && (
              <p className="text-xs text-medium-gray">Checking…</p>
            )}
            {!errors.invited_email && !emailChecking && emailHint === 'exists' && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Has a Wayfield account — they&apos;ll receive an email invitation
              </p>
            )}
            {!errors.invited_email && !emailChecking && emailHint === 'new' && (
              <p className="flex items-center gap-1.5 text-xs text-medium-gray">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                No Wayfield account yet — they&apos;ll be prompted to create one
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.invited_first_name}
              onChange={(e) => setF('invited_first_name', e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Last Name"
              value={form.invited_last_name}
              onChange={(e) => setF('invited_last_name', e.target.value)}
              placeholder="Optional"
            />
          </div>
          <p className="text-xs text-medium-gray -mt-3">
            Optional — helps personalize the invitation email
          </p>
        </form>
      )}
    </Modal>
  );
}

/* --- Self-enroll modal ----------------------------------------------- */

interface SelfEnrollForm {
  bio: string;
  website_url: string;
  city: string;
  state_or_region: string;
  phone_number: string;
  display_name: string;
}

const EMPTY_SELF_ENROLL: SelfEnrollForm = {
  bio: '',
  website_url: '',
  city: '',
  state_or_region: '',
  phone_number: '',
  display_name: '',
};

const BIO_MAX = 2000;

function SelfEnrollModal({
  open,
  orgId,
  workshopId,
  user,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  orgId: number;
  workshopId: number;
  user: AdminUser;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [form, setForm] = useState<SelfEnrollForm>(EMPTY_SELF_ENROLL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_SELF_ENROLL);
      setErrors({});
    }
  }, [open]);

  function setF<K extends keyof SelfEnrollForm>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost(`/organizations/${orgId}/leaders/self-enroll`, {
        bio: form.bio.trim() || undefined,
        website_url: form.website_url.trim() || undefined,
        city: form.city.trim() || undefined,
        state_or_region: form.state_or_region.trim() || undefined,
        phone_number: form.phone_number.trim() || undefined,
        display_name: form.display_name.trim() || undefined,
        workshop_id: workshopId,
      });
      toast.success("You've been added as a leader on this workshop.");
      onClose();
      onEnrolled();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(mapped);
      } else {
        toast.error('Failed to add yourself as leader. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Add Yourself as a Leader"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="self-enroll-form" type="submit" loading={saving}>
            Add Me as Leader
          </Button>
        </>
      }
    >
      <form id="self-enroll-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Read-only identity block */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-sm text-gray-500">{user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Your name and email come from your account and are shown to participants as-is.
          </p>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark" htmlFor="self-enroll-bio">
            Bio
          </label>
          <textarea
            id="self-enroll-bio"
            rows={5}
            value={form.bio}
            onChange={(e) => setF('bio', e.target.value.slice(0, BIO_MAX))}
            placeholder="Tell participants about your background, experience, and what you'll be teaching."
            disabled={saving}
            className={`
              w-full px-3 py-2 text-sm text-dark bg-white border rounded-lg outline-none
              transition-colors resize-none placeholder:text-light-gray
              focus:ring-2 focus:ring-primary/20 focus:border-primary
              disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed
              ${errors.bio ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
            `}
          />
          <div className="flex justify-between items-center">
            {errors.bio
              ? <p className="text-xs text-danger">{errors.bio}</p>
              : <span />
            }
            <p className="text-xs text-gray-400">{form.bio.length} / {BIO_MAX}</p>
          </div>
        </div>

        {/* Website */}
        <Input
          label="Website"
          type="url"
          value={form.website_url}
          onChange={(e) => setF('website_url', e.target.value)}
          placeholder="https://yourwebsite.com"
          error={errors.website_url}
          disabled={saving}
        />

        {/* City + State / Region */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setF('city', e.target.value)}
            placeholder="e.g. Chicago"
            error={errors.city}
            disabled={saving}
          />
          <Input
            label="State / Region"
            value={form.state_or_region}
            onChange={(e) => setF('state_or_region', e.target.value)}
            placeholder="e.g. Illinois"
            error={errors.state_or_region}
            disabled={saving}
          />
        </div>

        {/* Phone */}
        <Input
          label="Phone Number"
          type="tel"
          value={form.phone_number}
          onChange={(e) => setF('phone_number', e.target.value)}
          placeholder="+1 (312) 000-0000"
          error={errors.phone_number}
          helper="Only visible to participants in sessions you lead."
          disabled={saving}
        />

        {/* Display name */}
        <Input
          label="Display Name"
          value={form.display_name}
          onChange={(e) => setF('display_name', e.target.value)}
          placeholder="Leave blank to use your full name"
          error={errors.display_name}
          helper="If set, this is shown to participants instead of your first and last name."
          disabled={saving}
        />

        {/* Informational note */}
        <p className="text-xs text-gray-500">
          You can update your leader profile at any time from the Leader Profile settings.
          Your leader profile is shared across all workshops you lead.
        </p>
      </form>
    </Modal>
  );
}

/* --- Session assignment selector -------------------------------------- */

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

/* --- Leader slide-over ------------------------------------------------ */

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
  // Local session-removal confirmation within the slide-over
  const [removeSessionTarget, setRemoveSessionTarget] = useState<AssignedSession | null>(null);
  const [removingSession, setRemovingSession] = useState(false);

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

  async function handleConfirmRemoveSession() {
    if (!leader || !removeSessionTarget) return;
    setRemovingSession(true);
    try {
      await apiDelete(`/sessions/${removeSessionTarget.id}/leaders/${leader.id}`);
      toast.success('Removed from session');
      setRemoveSessionTarget(null);
      onUpdated();
    } catch {
      toast.error('Failed to remove leader from session');
    } finally {
      setRemovingSession(false);
    }
  }

  async function handleResendInvitation() {
    if (!leader?.invitation_id) return;
    setResending(true);
    try {
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResending(false);
    }
  }

  // Negative id means a pending invitation with no linked leader record yet.
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

  const removeSessionLeaderName = fullName || leader?.invited_email || 'this leader';

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
                <LeaderAvatar leader={leader} size="lg" />
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-dark text-base leading-snug">
                      {fullName || leader.invited_email || 'Invited Leader'}
                    </h3>
                    {leader.is_self_enrolled && (
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
                        You
                      </span>
                    )}
                  </div>
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

            {/* Read-only notice — leader profile details are leader-owned */}
            {!isPendingOnly && (
              <div className="px-6 py-5 border-b border-border-gray">
                <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <UserIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-500">
                    Leader profile details are managed by the leader from their own account settings.
                  </p>
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
                          onClick={() => setRemoveSessionTarget(s)}
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

      {/* Session removal confirmation — scoped to this slide-over */}
      <Modal
        open={!!removeSessionTarget}
        onClose={() => setRemoveSessionTarget(null)}
        title={`Remove ${removeSessionLeaderName} from ${removeSessionTarget?.title ?? 'this session'}?`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRemoveSessionTarget(null)}
              className="text-primary border-primary hover:bg-primary/5"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRemoveSession}
              loading={removingSession}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-medium-gray">
          They will lose roster access for this session.
        </p>
      </Modal>
    </>
  );
}

/* --- Confirm modal (rescind / remove leader / table session chip / remove self) */

function ConfirmModal({
  action,
  confirming,
  onConfirm,
  onCancel,
}: {
  action: ConfirmActionState | null;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!action) return null;

  const fullName =
    `${action.leader.first_name} ${action.leader.last_name}`.trim() ||
    action.leader.invited_email ||
    'this leader';

  let title: string;
  let description: string;
  let confirmLabel: string;
  let cancelLabel: string;

  if (action.type === 'rescind') {
    title = `Rescind invitation to ${fullName}?`;
    description = 'They will no longer be able to accept this invitation.';
    confirmLabel = 'Rescind';
    cancelLabel = 'Keep Invitation';
  } else if (action.type === 'remove_leader') {
    title = `Remove ${fullName} from this workshop?`;
    description = 'They will lose access to all assigned sessions and rosters.';
    confirmLabel = 'Remove Leader';
    cancelLabel = 'Keep Leader';
  } else if (action.type === 'remove_self') {
    title = 'Remove yourself as a leader from this workshop?';
    description = '';
    confirmLabel = 'Remove';
    cancelLabel = 'Cancel';
  } else {
    title = `Remove ${fullName} from ${action.session?.title ?? 'this session'}?`;
    description = '';
    confirmLabel = 'Remove';
    cancelLabel = 'Cancel';
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="text-primary border-primary hover:bg-primary/5"
          >
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={confirming}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-medium-gray">{description}</p>}
    </Modal>
  );
}

/* --- Session chips cell (table) --------------------------------------- */

function SessionChipsCell({
  leader,
  canRemove,
  onRemoveFromSession,
}: {
  leader: Leader;
  canRemove: boolean;
  onRemoveFromSession: (session: AssignedSession) => void;
}) {
  if (leader.invitation_status !== 'accepted') {
    return <span className="text-light-gray text-sm">—</span>;
  }

  const sessions = leader.assigned_sessions ?? [];
  if (sessions.length === 0) {
    return <span className="text-xs text-light-gray italic">No sessions assigned</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sessions.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium max-w-[200px]"
        >
          <span className="truncate">{s.title}</span>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemoveFromSession(s)}
              className="shrink-0 ml-0.5 text-primary/50 hover:text-danger transition-colors rounded-full"
              title={`Remove from ${s.title}`}
              aria-label={`Remove from ${s.title}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/* --- Leader table row ------------------------------------------------- */

function LeaderTableRow({
  leader,
  canRemove,
  timezone,
  onView,
  onConfirmAction,
}: {
  leader: Leader;
  canRemove: boolean;
  timezone: string;
  onView: () => void;
  onConfirmAction: (action: ConfirmActionState) => void;
}) {
  const isInactive = ['removed', 'rescinded', 'declined', 'expired'].includes(
    leader.invitation_status,
  );
  const displayName =
    `${leader.first_name} ${leader.last_name}`.trim() ||
    leader.invited_email ||
    'Invited Leader';
  const email = leader.invited_email || '—';
  const sentDate = leader.invitation_created_at
    ? formatInTimeZone(new Date(leader.invitation_created_at), timezone, 'MMM d, yyyy')
    : null;

  return (
    <tr
      className={`border-b border-border-gray last:border-b-0 transition-opacity ${
        isInactive ? 'opacity-50' : ''
      }`}
    >
      {/* Leader identity */}
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <LeaderAvatar leader={leader} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onView}
                className="text-sm font-medium text-dark hover:text-primary transition-colors text-left leading-snug truncate max-w-[180px]"
              >
                {displayName}
              </button>
              {leader.is_self_enrolled && (
                <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 border border-teal-200 shrink-0">
                  You
                </span>
              )}
            </div>
            {email !== '—' && (
              <p className="text-xs text-medium-gray truncate max-w-[180px]">{email}</p>
            )}
          </div>
        </div>
      </td>

      {/* Status + sent date */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <InviteStatusBadge status={leader.invitation_status} />
        {sentDate && (
          <p className="text-xs text-light-gray mt-1">{sentDate}</p>
        )}
      </td>

      {/* Sessions column */}
      <td className="py-3.5 px-4">
        <SessionChipsCell
          leader={leader}
          canRemove={canRemove && !isInactive && !leader.is_self_enrolled}
          onRemoveFromSession={(session) =>
            onConfirmAction({ type: 'remove_session', leader, session })
          }
        />
      </td>

      {/* Actions */}
      <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
        {leader.is_self_enrolled ? (
          <button
            type="button"
            onClick={() => onConfirmAction({ type: 'remove_self', leader })}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-danger/70 text-danger hover:bg-danger/5 transition-colors"
          >
            Remove Yourself
          </button>
        ) : (
          <>
            {leader.invitation_status === 'pending' && canRemove && (
              <button
                type="button"
                onClick={() => onConfirmAction({ type: 'rescind', leader })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-danger/70 text-danger hover:bg-danger/5 transition-colors"
              >
                Rescind Invitation
              </button>
            )}
            {leader.invitation_status === 'accepted' && canRemove && (
              <button
                type="button"
                onClick={() => onConfirmAction({ type: 'remove_leader', leader })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-danger/70 text-danger hover:bg-danger/5 transition-colors"
              >
                Remove Leader
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

/* --- Leaders table ---------------------------------------------------- */

function LeadersTable({
  leaders,
  canRemove,
  timezone,
  onView,
  onConfirmAction,
}: {
  leaders: Leader[];
  canRemove: boolean;
  timezone: string;
  onView: (leader: Leader) => void;
  onConfirmAction: (action: ConfirmActionState) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border-gray bg-surface/50">
              <th className="py-3 pl-5 pr-4 text-left text-xs font-medium text-medium-gray uppercase tracking-wide">
                Leader
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-medium-gray uppercase tracking-wide">
                Status
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-medium-gray uppercase tracking-wide">
                Sessions
              </th>
              <th className="py-3 pl-4 pr-5 text-right text-xs font-medium text-medium-gray uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((leader) => (
              <LeaderTableRow
                key={leader.invitation_id ?? leader.id}
                leader={leader}
                canRemove={canRemove}
                timezone={timezone}
                onView={() => onView(leader)}
                onConfirmAction={onConfirmAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* --- Empty state ------------------------------------------------------ */

function EmptyLeaders({ onInvite }: { onInvite: () => void }) {
  return (
    <Card className="py-20 px-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-5">
        <UserCheck className="w-7 h-7 text-light-gray" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-dark mb-2">No leaders yet</h3>
      <p className="text-sm text-medium-gray max-w-xs leading-relaxed mb-6">
        Invite leaders to this workshop. They&apos;ll receive an email and complete their own profile after accepting.
      </p>
      <Button onClick={onInvite}>
        <Plus className="w-4 h-4" />
        Invite Leader
      </Button>
    </Card>
  );
}

/* --- Main page -------------------------------------------------------- */

export default function WorkshopLeadersPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();
  const { currentOrg, user } = useUser();

  // owner and admin can rescind invitations and remove leaders; staff cannot.
  const canRemove =
    currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selfEnrollOpen, setSelfEnrollOpen] = useState(false);
  const [slideLeader, setSlideLeader] = useState<Leader | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);
  const [confirming, setConfirming] = useState(false);

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
        { label: 'Workshops', href: '/dashboard/workshops' },
        { label: 'Workshop', href: `/dashboard/workshops/${id}` },
        { label: 'Leaders' },
      ]);
      return;
    }
    setPage(workshop.title, [
      { label: 'Workshops', href: '/dashboard/workshops' },
      { label: workshop.title, href: `/dashboard/workshops/${id}` },
      { label: 'Leaders' },
    ]);
  }, [workshop, id, setPage]);

  // Current user is already enrolled if any leader row has is_self_enrolled=true
  const isAlreadyEnrolled = leaders.some((l) => l.is_self_enrolled);

  function openSlideOver(leader: Leader) {
    setSlideLeader(leader);
    setSlideOpen(true);
  }

  function handleSlideUpdated() {
    apiGet<Leader[]>(`/workshops/${id}/leaders`).then((res) => {
      const updated = (res ?? []).map((l) => ({ ...l, assigned_sessions: l.assigned_sessions ?? [] }));
      setLeaders(updated);
      if (slideLeader) {
        const fresh = updated.find((l) => l.id === slideLeader.id);
        if (fresh) setSlideLeader(fresh);
      }
    }).catch(() => {});
  }

  async function executeConfirmAction() {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      if (confirmAction.type === 'rescind') {
        await apiDelete(`/leader-invitations/${confirmAction.leader.invitation_id}`);
        // Optimistically mark as rescinded — row stays visible for audit history.
        setLeaders((prev) =>
          prev.map((l) =>
            l.invitation_id === confirmAction.leader.invitation_id
              ? { ...l, invitation_status: 'rescinded' as InvitationStatus }
              : l,
          ),
        );
        toast.success('Invitation rescinded');
      } else if (confirmAction.type === 'remove_leader') {
        await apiDelete(`/workshops/${id}/leaders/${confirmAction.leader.id}`);
        // Optimistically mark as removed — row stays visible for audit history.
        setLeaders((prev) =>
          prev.map((l) =>
            l.id === confirmAction.leader.id
              ? { ...l, invitation_status: 'removed' as InvitationStatus, assigned_sessions: [] }
              : l,
          ),
        );
        toast.success('Leader removed from workshop');
      } else if (confirmAction.type === 'remove_self') {
        await apiDelete(`/workshops/${id}/leaders/self`);
        toast.success("You've been removed from this workshop as a leader.");
        load();
      } else if (confirmAction.type === 'remove_session' && confirmAction.session) {
        const { session } = confirmAction;
        await apiDelete(`/sessions/${session.id}/leaders/${confirmAction.leader.id}`);
        // Optimistically remove the session chip.
        setLeaders((prev) =>
          prev.map((l) =>
            l.id === confirmAction.leader.id
              ? {
                  ...l,
                  assigned_sessions: (l.assigned_sessions ?? []).filter(
                    (s) => s.id !== session.id,
                  ),
                }
              : l,
          ),
        );
        toast.success('Leader removed from session');
      }
      setConfirmAction(null);
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <div className="h-64 bg-white rounded-xl border border-border-gray animate-pulse" />
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
          <div className="flex items-center gap-3">
            {canRemove && !isAlreadyEnrolled && (
              <button
                type="button"
                onClick={() => setSelfEnrollOpen(true)}
                className="inline-flex items-center gap-2 border border-teal-600 text-teal-600 hover:bg-teal-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Yourself as Leader
              </button>
            )}
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="w-4 h-4" />
              Invite Leader
            </Button>
          </div>
        </div>

        {/* Table or empty state */}
        {leaders.length === 0 ? (
          <EmptyLeaders onInvite={() => setInviteOpen(true)} />
        ) : (
          <LeadersTable
            leaders={leaders}
            canRemove={canRemove}
            timezone={workshop?.timezone ?? 'UTC'}
            onView={openSlideOver}
            onConfirmAction={setConfirmAction}
          />
        )}
      </div>

      {/* Invite modal */}
      {workshop && (
        <InviteModal
          open={inviteOpen}
          orgId={workshop.organization_id}
          workshopId={workshop.id}
          onClose={() => setInviteOpen(false)}
          onInvited={() => { load(); }}
        />
      )}

      {/* Self-enroll modal */}
      {workshop && user && (
        <SelfEnrollModal
          open={selfEnrollOpen}
          orgId={workshop.organization_id}
          workshopId={workshop.id}
          user={user}
          onClose={() => setSelfEnrollOpen(false)}
          onEnrolled={load}
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

      {/* Confirmation modal (rescind / remove leader / remove from session via chip / remove self) */}
      <ConfirmModal
        action={confirmAction}
        confirming={confirming}
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
