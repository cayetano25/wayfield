'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, apiPatch, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

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

type RoleOption = 'owner' | 'admin' | 'staff' | 'billing_admin';

const ROLE_OPTIONS: { value: RoleOption; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'billing_admin', label: 'Billing Admin' },
];

function MemberAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
      {initials}
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

  // Add member modal state
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

  // Admins cannot demote owners
  function canEditMember(member: OrgMember): boolean {
    if (!canManage) return false;
    if (member.role === 'owner' && !isOwner) return false;
    return true;
  }

  // Admins cannot set role to 'owner'
  function availableRolesForEdit(member: OrgMember): typeof ROLE_OPTIONS {
    if (isOwner) return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter((r) => r.value !== 'owner');
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
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add member
          </Button>
        )}
      </div>

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
                    {/* Member info */}
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

                    {/* Role */}
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

                    {/* Status */}
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

                    {/* Joined date */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm text-medium-gray">{formatDate(member.created_at)}</span>
                    </td>

                    {/* Actions */}
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

      {/* Add Member Modal */}
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
    </div>
  );
}
