'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, UserPlus, Clock, CheckCircle } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api/client';
import { checkEmailExists } from '@/lib/api/invitations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgMemberUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string | null;
}

interface OrgMember {
  id: number;
  user: OrgMemberUser;
  role: 'owner' | 'admin' | 'staff' | 'billing_admin';
  is_active: boolean;
  joined_at: string;
}

interface PendingInvitation {
  id: number;
  invited_email: string;
  invited_first_name: string | null;
  invited_last_name: string | null;
  role: 'admin' | 'staff' | 'billing_admin';
  status: string;
  expires_at: string;
  created_at: string;
}

interface MembersResponse {
  members: OrgMember[];
  pending_invitations: PendingInvitation[];
}

type InviteRole = 'admin' | 'staff' | 'billing_admin';
type ChangeableRole = 'admin' | 'staff' | 'billing_admin';

const INVITE_ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
  { value: 'admin',         label: 'Admin',          description: 'Full workshop management and member access' },
  { value: 'staff',         label: 'Staff',          description: 'Workshop and session access, roster and attendance' },
  { value: 'billing_admin', label: 'Billing Admin',  description: 'Billing and subscription management only' },
];

const CHANGE_ROLE_OPTIONS: { value: ChangeableRole; label: string; description: string }[] = [
  { value: 'admin',         label: 'Admin',          description: 'Full workshop management and member access' },
  { value: 'staff',         label: 'Staff',          description: 'Workshop and session access, roster and attendance' },
  { value: 'billing_admin', label: 'Billing Admin',  description: 'Billing and subscription management only' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 1) return `${days} days ago`;
  if (days === 1) return '1 day ago';
  return 'Today';
}

function daysUntilExpiry(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner:         'bg-dark text-white',
  admin:         'bg-teal-100 text-teal-700',
  staff:         'bg-sky-100 text-sky-600',
  billing_admin: 'bg-orange-100 text-orange-700',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', staff: 'Staff', billing_admin: 'Billing Admin',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_CLASSES[role] ?? 'bg-surface text-medium-gray'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
      Pending
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function MemberAvatar({ user }: { user: OrgMemberUser }) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();
  if (user.profile_image_url) {
    return (
      <Image
        src={user.profile_image_url}
        alt={`${user.first_name} ${user.last_name}`}
        width={32}
        height={32}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0 select-none">
      {initials}
    </div>
  );
}

function InvitationAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-surface border border-border-gray flex items-center justify-center shrink-0">
      <Mail className="w-3.5 h-3.5 text-medium-gray" />
    </div>
  );
}

// ─── Invite Member Modal ──────────────────────────────────────────────────────

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  orgId: number;
  isOwner: boolean;
  onSuccess: (email: string) => void;
}

function InviteMemberModal({ open, onClose, orgId, isOwner, onSuccess }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<InviteRole>('staff');
  const [emailHint, setEmailHint] = useState<'exists' | 'new' | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});

  useEffect(() => {
    if (open) {
      setEmail(''); setFirstName(''); setLastName('');
      setRole('staff'); setEmailHint(null); setErrors({});
    }
  }, [open]);

  async function handleEmailBlur() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailHint(null); return; }
    setEmailChecking(true);
    try {
      const exists = await checkEmailExists(trimmed);
      setEmailHint(exists ? 'exists' : 'new');
    } catch { setEmailHint(null); }
    finally { setEmailChecking(false); }
  }

  async function handleSubmit() {
    setErrors({});
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setErrors({ email: 'Email is required.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address.' }); return;
    }
    setIsSaving(true);
    try {
      await apiPost(`/organizations/${orgId}/invitations`, {
        invited_email: trimmedEmail,
        role,
        invited_first_name: firstName.trim() || null,
        invited_last_name: lastName.trim() || null,
      });
      onSuccess(trimmedEmail);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const serverMsg = err.errors?.invited_email?.[0] ?? err.errors?.email?.[0];
        if (err.status === 422 && (err.message.includes('pending') || err.message.includes('already'))) {
          setErrors({ general: err.message });
        } else if (serverMsg) {
          setErrors({ email: serverMsg });
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({ general: 'Failed to send invitation.' });
      }
    } finally {
      setIsSaving(false);
    }
  }

  const availableRoles = isOwner
    ? INVITE_ROLE_OPTIONS
    : INVITE_ROLE_OPTIONS.filter((r) => r.value === 'staff');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Team Member"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving}>
            <UserPlus className="w-4 h-4" />
            Send Invitation
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {errors.general && (
          <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">
            {errors.general}
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
            Email Address <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailHint(null); setErrors((p) => ({ ...p, email: undefined })); }}
            onBlur={handleEmailBlur}
            placeholder="colleague@example.com"
            autoComplete="off"
            className={`
              w-full h-10 px-3 text-sm text-dark bg-white border rounded-lg outline-none transition-colors
              placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary
              ${errors.email ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
            `}
          />
          {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
          {!errors.email && emailChecking && <p className="text-xs text-medium-gray">Checking…</p>}
          {!errors.email && !emailChecking && emailHint === 'exists' && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              Has a Wayfield account — they&apos;ll receive an email invitation
            </p>
          )}
          {!errors.email && !emailChecking && emailHint === 'new' && (
            <p className="flex items-center gap-1.5 text-xs text-medium-gray">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              No Wayfield account yet — they&apos;ll be prompted to create one
            </p>
          )}
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Optional"
              className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none transition-colors placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Optional"
              className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none transition-colors placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <p className="text-xs text-medium-gray -mt-3">
          Optional — helps personalize the invitation email
        </p>

        {/* Role selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
            Role <span className="text-danger">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {availableRoles.map((opt) => {
              const isSelected = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg border transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border-gray bg-white hover:border-medium-gray hover:bg-surface'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-dark'}`}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 10 10">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-medium-gray mt-0.5">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Change Role Modal ────────────────────────────────────────────────────────

interface ChangeRoleModalProps {
  open: boolean;
  onClose: () => void;
  member: OrgMember | null;
  orgId: number;
  onSuccess: (memberId: number, newRole: ChangeableRole) => void;
}

function ChangeRoleModal({ open, onClose, member, orgId, onSuccess }: ChangeRoleModalProps) {
  const [role, setRole] = useState<ChangeableRole>('staff');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && member && member.role !== 'owner') {
      setRole(member.role as ChangeableRole);
      setError(null);
    }
  }, [open, member]);

  async function handleSave() {
    if (!member) return;
    setIsSaving(true); setError(null);
    try {
      await apiPatch(`/organizations/${orgId}/members/${member.id}`, { role });
      onSuccess(member.id, role);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role.');
    } finally {
      setIsSaving(false);
    }
  }

  const fullName = member ? `${member.user.first_name} ${member.user.last_name}` : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change Role for ${fullName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} loading={isSaving}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">{error}</div>
        )}
        {member && (
          <p className="text-sm text-medium-gray">
            Currently: <span className="font-medium text-dark">{ROLE_LABELS[member.role] ?? member.role}</span>
          </p>
        )}
        <div className="flex flex-col gap-2">
          {CHANGE_ROLE_OPTIONS.map((opt) => {
            const isSelected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border-gray bg-white hover:border-medium-gray hover:bg-surface'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-dark'}`}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 10 10">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs text-medium-gray mt-0.5">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ─── Remove Member Dialog ─────────────────────────────────────────────────────

interface RemoveMemberDialogProps {
  open: boolean;
  onClose: () => void;
  member: OrgMember | null;
  orgName: string;
  orgId: number;
  onSuccess: (memberId: number) => void;
}

function RemoveMemberDialog({ open, onClose, member, orgName, orgId, onSuccess }: RemoveMemberDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setError(null); }, [open]);

  async function handleConfirm() {
    if (!member) return;
    setIsRemoving(true); setError(null);
    try {
      await apiDelete(`/organizations/${orgId}/members/${member.id}`);
      onSuccess(member.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member.');
      setIsRemoving(false);
    }
  }

  const fullName = member ? `${member.user.first_name} ${member.user.last_name}` : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Remove ${fullName} from ${orgName}?`}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isRemoving}
            className="text-primary border-primary hover:bg-primary/5"
          >
            Keep Member
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={isRemoving}>
            Remove Member
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">{error}</div>
        )}
        <p className="text-sm text-medium-gray">
          They will immediately lose access to all workshops and admin tools.
          Their Wayfield account is not affected.
        </p>
      </div>
    </Modal>
  );
}

// ─── Rescind Dialog ───────────────────────────────────────────────────────────

interface RescindDialogProps {
  open: boolean;
  onClose: () => void;
  invitation: PendingInvitation | null;
  orgId: number;
  onSuccess: (invitationId: number) => void;
}

function RescindDialog({ open, onClose, invitation, orgId, onSuccess }: RescindDialogProps) {
  const [isRescinding, setIsRescinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setError(null); }, [open]);

  async function handleConfirm() {
    if (!invitation) return;
    setIsRescinding(true); setError(null);
    try {
      await apiDelete(`/organizations/${orgId}/invitations/${invitation.id}`);
      onSuccess(invitation.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to rescind invitation.');
      setIsRescinding(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rescind invitation to ${invitation?.invited_email ?? ''}?`}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isRescinding}
            className="text-primary border-primary hover:bg-primary/5"
          >
            Keep Invitation
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={isRescinding}>
            Rescind
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">{error}</div>
        )}
        <p className="text-sm text-medium-gray">
          They will no longer be able to accept this invitation.
        </p>
      </div>
    </Modal>
  );
}

// ─── Pending Invitations Section ──────────────────────────────────────────────

interface PendingInvitationsSectionProps {
  invitations: PendingInvitation[];
  removingIds: Set<number>;
  resendingIds: Set<number>;
  canManage: boolean;
  onResend: (inv: PendingInvitation) => void;
  onRescind: (inv: PendingInvitation) => void;
}

function PendingInvitationsSection({
  invitations, removingIds, resendingIds, canManage, onResend, onRescind,
}: PendingInvitationsSectionProps) {
  if (invitations.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="font-heading text-base font-semibold text-dark mb-3">
        Pending Invitations
      </h2>
      <Card>
        <div className="divide-y divide-border-gray">
          {invitations.map((inv) => {
            const displayName =
              inv.invited_first_name || inv.invited_last_name
                ? `${inv.invited_first_name ?? ''} ${inv.invited_last_name ?? ''}`.trim()
                : null;
            const isRemoving = removingIds.has(inv.id);
            const isResending = resendingIds.has(inv.id);
            const daysLeft = daysUntilExpiry(inv.expires_at);

            return (
              <div
                key={inv.id}
                className="px-5 py-3.5 flex items-center gap-3 transition-opacity duration-300"
                style={{ opacity: isRemoving ? 0 : 1 }}
              >
                <InvitationAvatar />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark truncate">
                      {inv.invited_email}
                    </span>
                    <RoleBadge role={inv.role} />
                    <PendingBadge />
                  </div>
                  {displayName && (
                    <p className="text-xs text-medium-gray mt-0.5">{displayName}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3 text-light-gray shrink-0" />
                    <span className="text-xs text-light-gray">
                      Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResend(inv)}
                      disabled={isResending || isRemoving}
                      className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                    >
                      {isResending ? 'Resending…' : 'Resend'}
                    </button>
                    <span className="text-border-gray text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => onRescind(inv)}
                      disabled={isRemoving}
                      className="text-xs font-medium text-danger hover:text-danger/80 disabled:opacity-50 transition-colors"
                    >
                      Rescind
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Member Table Row ─────────────────────────────────────────────────────────

type RowAction = 'change_role_and_remove' | 'remove_only' | 'none';

function resolveRowAction(
  viewerRole: string,
  viewerUserId: number,
  member: OrgMember,
): RowAction {
  if (viewerRole === 'staff' || viewerRole === 'billing_admin') return 'none';
  if (viewerRole === 'owner' && member.user.id === viewerUserId) return 'none';
  if (viewerRole === 'owner' && member.role === 'owner') return 'none';
  if (viewerRole === 'owner') return 'change_role_and_remove';
  // admin
  if (member.role === 'staff' && member.user.id !== viewerUserId) return 'remove_only';
  return 'none';
}

interface MemberRowProps {
  member: OrgMember;
  viewerRole: string;
  viewerUserId: number;
  isRemoved: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
}

function MemberRow({ member, viewerRole, viewerUserId, isRemoved, onChangeRole, onRemove }: MemberRowProps) {
  const action = resolveRowAction(viewerRole, viewerUserId, member);
  const fullName = `${member.user.first_name} ${member.user.last_name}`;

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      {/* Avatar + name */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <MemberAvatar user={member.user} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-dark truncate">{fullName}</p>
            <p className="text-xs text-medium-gray truncate">{member.user.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-6 py-4 hidden md:table-cell">
        <RoleBadge role={member.role} />
      </td>

      {/* Status */}
      <td className="px-6 py-4 hidden lg:table-cell">
        {isRemoved ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-light-gray">
            Removed
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={`text-sm ${member.is_active ? 'text-emerald-700' : 'text-medium-gray'}`}>
              {member.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        )}
      </td>

      {/* Joined */}
      <td className="px-6 py-4 hidden lg:table-cell">
        <span className="text-sm text-medium-gray">{timeAgo(member.joined_at)}</span>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right whitespace-nowrap">
        {!isRemoved && action === 'change_role_and_remove' && (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onChangeRole}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Change Role
            </button>
            <span className="text-border-gray text-xs">·</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-danger hover:text-danger/80 transition-colors"
            >
              Remove
            </button>
          </div>
        )}
        {!isRemoved && action === 'remove_only' && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-danger hover:text-danger/80 transition-colors"
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrganizationMembersPage() {
  useSetPage('Members', [
    { label: 'Organization' },
    { label: 'Members' },
  ]);

  const { user, currentOrg } = useUser();
  const viewerRole = currentOrg?.role ?? '';
  const viewerUserId = user?.id ?? 0;
  const isOwner = viewerRole === 'owner';
  const canManage = viewerRole === 'owner' || viewerRole === 'admin';

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Optimistic removal tracking
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<number>>(new Set());
  const [removingInvitationIds, setRemovingInvitationIds] = useState<Set<number>>(new Set());
  const [resendingInvitationIds, setResendingInvitationIds] = useState<Set<number>>(new Set());

  // Modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changeRoleMember, setChangeRoleMember] = useState<OrgMember | null>(null);
  const [removeMember, setRemoveMember] = useState<OrgMember | null>(null);
  const [rescindInvitation, setRescindInvitation] = useState<PendingInvitation | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const res = await apiGet<MembersResponse>(`/organizations/${currentOrg.id}/members`);
      setMembers(res.members ?? []);
      setPendingInvitations(res.pending_invitations ?? []);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  function handleInviteSuccess(email: string) {
    toast.success(`Invitation sent to ${email}`);
    load();
  }

  function handleChangeRoleSuccess(memberId: number, newRole: ChangeableRole) {
    setMembers((prev) =>
      prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m)
    );
    const member = members.find((m) => m.id === memberId);
    if (member) {
      toast.success(`${member.user.first_name} ${member.user.last_name}'s role has been updated to ${ROLE_LABELS[newRole]}.`);
    }
  }

  function handleRemoveMemberSuccess(memberId: number) {
    const member = members.find((m) => m.id === memberId);
    setRemovedMemberIds((prev) => new Set(prev).add(memberId));
    if (member && currentOrg) {
      toast.success(`${member.user.first_name} ${member.user.last_name} has been removed from ${currentOrg.name}.`);
    }
    // Remove the row after a short delay so the Removed badge is briefly visible
    setTimeout(() => {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovedMemberIds((prev) => { const next = new Set(prev); next.delete(memberId); return next; });
    }, 1500);
  }

  async function handleResend(inv: PendingInvitation) {
    if (!currentOrg) return;
    setResendingInvitationIds((prev) => new Set(prev).add(inv.id));
    try {
      await apiPost(`/organizations/${currentOrg.id}/invitations/${inv.id}/resend`);
      toast.success(`Invitation resent to ${inv.invited_email}`);
      // Refresh to pick up updated expires_at
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingInvitationIds((prev) => { const next = new Set(prev); next.delete(inv.id); return next; });
    }
  }

  function handleRescindSuccess(invitationId: number) {
    setRemovingInvitationIds((prev) => new Set(prev).add(invitationId));
    toast.success('Invitation rescinded');
    setTimeout(() => {
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setRemovingInvitationIds((prev) => { const next = new Set(prev); next.delete(invitationId); return next; });
    }, 300);
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-medium-gray">
          Manage who has access to this organization and their roles.
        </p>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Pending invitations */}
      {currentOrg && (
        <PendingInvitationsSection
          invitations={pendingInvitations}
          removingIds={removingInvitationIds}
          resendingIds={resendingInvitationIds}
          canManage={canManage}
          onResend={handleResend}
          onRescind={(inv) => setRescindInvitation(inv)}
        />
      )}

      {/* Active members table */}
      <Card>
        {loading ? (
          <div className="px-6 py-8 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-medium-gray text-sm">No members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border-gray">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden md:table-cell">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden lg:table-cell">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-light-gray">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-gray">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    viewerRole={viewerRole}
                    viewerUserId={viewerUserId}
                    isRemoved={removedMemberIds.has(member.id)}
                    onChangeRole={() => setChangeRoleMember(member)}
                    onRemove={() => setRemoveMember(member)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invite Member Modal */}
      {currentOrg && (
        <InviteMemberModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          orgId={currentOrg.id}
          isOwner={isOwner}
          onSuccess={handleInviteSuccess}
        />
      )}

      {/* Change Role Modal */}
      {currentOrg && (
        <ChangeRoleModal
          open={!!changeRoleMember}
          onClose={() => setChangeRoleMember(null)}
          member={changeRoleMember}
          orgId={currentOrg.id}
          onSuccess={handleChangeRoleSuccess}
        />
      )}

      {/* Remove Member Dialog */}
      {currentOrg && (
        <RemoveMemberDialog
          open={!!removeMember}
          onClose={() => setRemoveMember(null)}
          member={removeMember}
          orgName={currentOrg.name}
          orgId={currentOrg.id}
          onSuccess={handleRemoveMemberSuccess}
        />
      )}

      {/* Rescind Invitation Dialog */}
      {currentOrg && (
        <RescindDialog
          open={!!rescindInvitation}
          onClose={() => setRescindInvitation(null)}
          invitation={rescindInvitation}
          orgId={currentOrg.id}
          onSuccess={handleRescindSuccess}
        />
      )}
    </div>
  );
}
