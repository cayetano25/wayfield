'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Check, X, Mail, UserPlus, Clock, CheckCircle } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api/client';
import { checkEmailExists } from '@/lib/api/invitations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

// --- Types --------------------------------------------------------------------

interface OrgMember {
  id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  role: 'owner' | 'admin' | 'staff' | 'billing_admin';
  is_active: boolean;
  created_at: string;
}

interface PendingInvitation {
  id: number;
  invited_email: string;
  invited_first_name: string | null;
  invited_last_name: string | null;
  role: 'admin' | 'staff' | 'billing_admin';
  role_display: string;
  created_at: string;
  expires_at: string;
}

type RoleOption = 'owner' | 'admin' | 'staff' | 'billing_admin';
type InviteRole = 'admin' | 'staff' | 'billing_admin';

const ROLE_OPTIONS: { value: RoleOption; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'billing_admin', label: 'Billing Admin' },
];

const INVITE_ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
  { value: 'staff',         label: 'Staff',          description: 'Day-to-day workshop management' },
  { value: 'admin',         label: 'Administrator',  description: 'Full operational access' },
  { value: 'billing_admin', label: 'Billing Only',   description: 'Billing and invoices only' },
];

// --- Helpers ------------------------------------------------------------------

function MemberAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

function InviteAvatar({ name, email }: { name: string | null; email: string }) {
  const char = name ? name[0].toUpperCase() : email[0].toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-medium-gray text-xs font-semibold shrink-0">
      {char}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// --- Invite Member Slide-Over -------------------------------------------------

interface InviteSlideOverProps {
  open: boolean;
  onClose: () => void;
  orgId: number;
  isOwner: boolean;
  onSuccess: (email: string) => void;
}

function InviteSlideOver({ open, onClose, orgId, isOwner, onSuccess }: InviteSlideOverProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<InviteRole>('staff');
  const [emailHint, setEmailHint] = useState<{ type: 'exists' | 'new' } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('staff');
      setEmailHint(null);
      setErrors({});
    }
  }, [open]);

  async function handleEmailBlur() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailHint(null);
      return;
    }
    setEmailChecking(true);
    try {
      const exists = await checkEmailExists(trimmed);
      setEmailHint({ type: exists ? 'exists' : 'new' });
    } catch {
      setEmailHint(null);
    } finally {
      setEmailChecking(false);
    }
  }

  async function handleSubmit() {
    setErrors({});
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrors({ email: 'Email is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setIsSaving(true);
    try {
      await apiPost(`/organizations/${orgId}/invitations`, {
        email: trimmedEmail,
        role,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      });
      onSuccess(trimmedEmail);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors({
          email: err.errors.email?.[0],
          general: err.errors.general?.[0],
        });
      } else {
        setErrors({ general: err instanceof ApiError ? err.message : 'Failed to send invitation.' });
      }
    } finally {
      setIsSaving(false);
    }
  }

  const availableRoles = isOwner
    ? INVITE_ROLE_OPTIONS
    : INVITE_ROLE_OPTIONS.filter((r) => r.value !== 'admin');

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-dark/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 w-full max-w-[400px] bg-white shadow-[−8px_0_40px_rgba(46,46,46,0.12)] flex flex-col"
        style={{ animation: 'slideInRight 220ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-gray shrink-0">
          <h2 className="font-heading text-[18px] font-bold text-dark">Invite a Team Member</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-light-gray hover:text-dark hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {errors.general && (
            <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">
              {errors.general}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
              Email Address
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
            {errors.email && (
              <p className="text-xs text-danger">{errors.email}</p>
            )}
            {!errors.email && emailChecking && (
              <p className="text-xs text-medium-gray">Checking...</p>
            )}
            {!errors.email && !emailChecking && emailHint?.type === 'exists' && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Has a Wayfield account — they&apos;ll receive an email invitation
              </p>
            )}
            {!errors.email && !emailChecking && emailHint?.type === 'new' && (
              <p className="flex items-center gap-1.5 text-xs text-medium-gray">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                No Wayfield account yet — they&apos;ll be prompted to create one
              </p>
            )}
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none transition-colors placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none transition-colors placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Role segmented chooser */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-dark tracking-[0.06em] uppercase">
              Role
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
                          <Check className="w-2.5 h-2.5 text-white" />
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-gray shrink-0 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving}>
            <UserPlus className="w-4 h-4" />
            Send Invitation
          </Button>
        </div>
      </div>
    </>
  );
}

// --- Pending Invitations Section ----------------------------------------------

interface PendingInvitationsSectionProps {
  orgId: number;
  refreshKey: number;
  canManage: boolean;
}

function PendingInvitationsSection({ orgId, refreshKey, canManage }: PendingInvitationsSectionProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    apiGet<PendingInvitation[]>(`/organizations/${orgId}/invitations?status=pending`)
      .then((res) => setInvitations(res ?? []))
      .catch(() => {
        // silently skip — non-critical
      });
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleCancel(id: number) {
    setCancellingId(id);
    try {
      await apiDelete(`/organizations/${orgId}/invitations/${id}`);
      // Fade-out by marking as removing, then remove after animation
      setRemovingIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setInvitations((prev) => prev.filter((inv) => inv.id !== id));
        setRemovingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }, 300);
      toast.success('Invitation cancelled');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to cancel invitation');
    } finally {
      setCancellingId(null);
      setCancelConfirmId(null);
    }
  }

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

            return (
              <div
                key={inv.id}
                className="px-5 py-3.5 flex items-center gap-3 transition-opacity duration-300"
                style={{ opacity: isRemoving ? 0 : 1 }}
              >
                <InviteAvatar name={displayName} email={inv.invited_email} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark truncate">
                      {displayName ?? inv.invited_email}
                    </span>
                    {displayName && (
                      <span className="text-xs text-medium-gray truncate hidden sm:block">
                        {inv.invited_email}
                      </span>
                    )}
                    <Badge variant={`role-${inv.role}` as `role-${typeof inv.role}`}>
                      {inv.role_display}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3 text-light-gray shrink-0" />
                    <span className="text-xs text-light-gray">Sent {daysAgo(inv.created_at)}</span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    {cancelConfirmId === inv.id ? (
                      <>
                        <span className="text-xs text-medium-gray hidden sm:block">Are you sure?</span>
                        <button
                          type="button"
                          onClick={() => handleCancel(inv.id)}
                          disabled={cancellingId === inv.id}
                          className="text-xs font-semibold text-danger hover:text-[#d4432f] disabled:opacity-50 transition-colors"
                        >
                          {cancellingId === inv.id ? 'Cancelling...' : 'Yes, cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelConfirmId(null)}
                          disabled={cancellingId === inv.id}
                          className="text-xs text-medium-gray hover:text-dark disabled:opacity-50 transition-colors"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(inv.id)}
                        className="text-xs font-medium text-danger hover:text-[#d4432f] transition-colors"
                      >
                        Cancel
                      </button>
                    )}
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

// --- Main page ----------------------------------------------------------------

export default function OrganizationMembersPage() {
  useSetPage('Members', [
    { label: 'Organization' },
    { label: 'Members' },
  ]);

  const { currentOrg } = useUser();
  const role = currentOrg?.role ?? '';
  const isOwner = role === 'owner';
  const canManage = role === 'owner' || role === 'admin';

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite slide-over
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);

  // Add member modal state (existing)
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<RoleOption>('staff');
  const [addErrors, setAddErrors] = useState<{ email?: string; role?: string; general?: string }>({});
  const [addSaving, setAddSaving] = useState(false);

  // Edit row state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<RoleOption>('staff');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  function loadMembers() {
    if (!currentOrg) return;
    setLoading(true);
    apiGet<OrgMember[]>(`/organizations/${currentOrg.id}/users`)
      .then((res) => setMembers(res ?? []))
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  function openEdit(member: OrgMember) {
    setEditingId(member.id);
    setEditRole(member.role);
    setEditActive(member.is_active);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(memberId: number) {
    if (!currentOrg) return;
    setEditSaving(true);
    try {
      await apiPatch(`/organizations/${currentOrg.id}/users/${memberId}`, {
        role: editRole,
        is_active: editActive,
      });
      toast.success('Member updated');
      setEditingId(null);
      loadMembers();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update member';
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  }

  function openAdd() {
    setAddEmail('');
    setAddRole('staff');
    setAddErrors({});
    setAddOpen(true);
  }

  async function submitAdd() {
    if (!currentOrg) return;
    setAddErrors({});
    if (!addEmail.trim()) {
      setAddErrors({ email: 'Email is required' });
      return;
    }
    setAddSaving(true);
    try {
      await apiPost(`/organizations/${currentOrg.id}/users`, {
        email: addEmail.trim(),
        role: addRole,
      });
      toast.success('Member added');
      setAddOpen(false);
      loadMembers();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setAddErrors({
          email: err.errors.email?.[0],
          role: err.errors.role?.[0],
          general: err.errors.general?.[0],
        });
      } else {
        setAddErrors({ general: err instanceof ApiError ? err.message : 'Failed to add member' });
      }
    } finally {
      setAddSaving(false);
    }
  }

  function canEditMember(member: OrgMember): boolean {
    if (!canManage) return false;
    if (member.role === 'owner' && !isOwner) return false;
    return true;
  }

  function availableRolesForEdit(member: OrgMember): typeof ROLE_OPTIONS {
    if (isOwner) return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter((r) => r.value !== 'owner');
  }

  function handleInviteSuccess(email: string) {
    toast.success(`Invitation sent to ${email}`);
    setPendingRefreshKey((k) => k + 1);
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-medium-gray">
            Manage who has access to this organization and their roles.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openAdd}>
              <Plus className="w-4 h-4" />
              Add member
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          </div>
        )}
      </div>

      {/* Pending invitations — only shown when there are open invites */}
      {currentOrg && (
        <PendingInvitationsSection
          orgId={currentOrg.id}
          refreshKey={pendingRefreshKey}
          canManage={canManage}
        />
      )}

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
          <table className="w-full min-w-[480px]">
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
                {canManage && (
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-light-gray">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-gray">
              {members.map((member) => {
                const isEditing = editingId === member.id;
                return (
                  <tr key={member.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          firstName={member.user.first_name}
                          lastName={member.user.last_name}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-dark truncate">
                            {member.user.first_name} {member.user.last_name}
                          </p>
                          <p className="text-xs text-medium-gray truncate">{member.user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 hidden md:table-cell">
                      {isEditing ? (
                        <Select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as RoleOption)}
                          className="w-36"
                        >
                          {availableRolesForEdit(member).map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={`role-${member.role}` as `role-${typeof member.role}`} />
                      )}
                    </td>

                    <td className="px-6 py-4 hidden lg:table-cell">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => setEditActive((v) => !v)}
                          className={`
                            inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer
                            transition-colors
                            ${editActive
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-surface text-medium-gray hover:bg-border-gray'
                            }
                          `}
                        >
                          {editActive ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <Badge
                          variant={member.is_active ? 'status-active' : 'status-archived'}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </td>

                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm text-medium-gray">{formatDate(member.created_at)}</span>
                    </td>

                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={editSaving}
                              onClick={() => saveEdit(member.id)}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={cancelEdit}
                              disabled={editSaving}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : canEditMember(member) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(member)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {/* Add Member Modal (existing) */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button onClick={submitAdd} loading={addSaving}>
              Add member
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {addErrors.general && (
            <div className="px-4 py-3 rounded-lg bg-danger/8 border border-danger/20 text-sm text-danger">
              {addErrors.general}
            </div>
          )}
          <Input
            label="Email address"
            type="email"
            value={addEmail}
            onChange={(e) => {
              setAddEmail(e.target.value);
              setAddErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={addErrors.email}
            placeholder="member@example.com"
            autoFocus
          />
          <Select
            label="Role"
            value={addRole}
            onChange={(e) => {
              setAddRole(e.target.value as RoleOption);
              setAddErrors((prev) => ({ ...prev, role: undefined }));
            }}
            error={addErrors.role}
          >
            {(isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value !== 'owner')).map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Invite Member Slide-Over */}
      {currentOrg && (
        <InviteSlideOver
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          orgId={currentOrg.id}
          isOwner={isOwner}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
