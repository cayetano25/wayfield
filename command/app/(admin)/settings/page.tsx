'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Settings, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  platformConfig,
  platformAdmins,
  type PlatformConfig,
  type PlatformAdminEntry,
  type AdminRole,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin:       'bg-blue-50 text-blue-700 ring-blue-200',
  support:     'bg-teal-50 text-teal-700 ring-teal-200',
  billing:     'bg-amber-50 text-amber-700 ring-amber-200',
  readonly:    'bg-gray-100 text-gray-600 ring-gray-200',
};

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_COLORS[role] ?? ROLE_COLORS.readonly}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── Inline config editor row ─────────────────────────────────────────────────

function ConfigRow({ item, onSaved }: { item: PlatformConfig; onSaved: (updated: PlatformConfig) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(item.config_value);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft('');
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await platformConfig.update(item.config_key, draft);
      onSaved(data);
      setEditing(false);
      toast.show(`Config "${item.config_key}" updated.`, 'success');
    } catch {
      toast.show('Failed to update config.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <code className="text-sm font-mono text-gray-800">{item.config_key}</code>
        </div>
        {item.description && (
          <p className="text-xs text-gray-400">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[40px] w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              aria-label={`Edit ${item.config_key}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
              }}
            />
            <button
              onClick={save}
              disabled={saving}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50 transition-colors"
              aria-label="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50 transition-colors"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-700 font-mono max-w-[240px] truncate">
              {item.config_value || <span className="text-gray-300 italic">empty</span>}
            </span>
            <button
              onClick={startEdit}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={`Edit ${item.config_key}`}
            >
              <Pencil size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Invite admin modal ───────────────────────────────────────────────────────

const INVITABLE_ROLES: Array<{ value: Exclude<AdminRole, 'super_admin'>; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'readonly', label: 'Read-only' },
];

interface InviteAdminModalProps {
  onClose: () => void;
  onCreated: (admin: PlatformAdminEntry) => void;
}

function InviteAdminModal({ onClose, onCreated }: InviteAdminModalProps) {
  const toast = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<AdminRole, 'super_admin'>>('support');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'Required.';
    if (!lastName.trim()) errs.lastName = 'Required.';
    if (!email.trim()) errs.email = 'Required.';
    if (password.length < 12) errs.password = 'Must be at least 12 characters.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const { data } = await platformAdmins.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        password_confirmation: password,
        role,
      });
      onCreated(data);
      toast.show(`${data.first_name} ${data.last_name} added.`, 'success');
    } catch {
      setErrors({ general: 'Failed to create admin. The email may already be in use.' });
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-5">Add Platform Admin</h2>

        {errors.general && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors.general}
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 12 characters"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<AdminRole, 'super_admin'>)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit role modal ──────────────────────────────────────────────────────────

const ALL_ROLES: Array<{ value: AdminRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'readonly', label: 'Read-only' },
];

interface EditRoleModalProps {
  target: PlatformAdminEntry;
  isLastSuperAdmin: boolean;
  currentUserId: number;
  onClose: () => void;
  onSaved: (admin: PlatformAdminEntry) => void;
}

function EditRoleModal({ target, isLastSuperAdmin, currentUserId, onClose, onSaved }: EditRoleModalProps) {
  const toast = useToast();
  const [role, setRole] = useState<AdminRole>(target.role);
  const [saving, setSaving] = useState(false);

  const isSelf = target.id === currentUserId;

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await platformAdmins.updateRole(target.id, role);
      onSaved(data);
      toast.show(`${target.first_name}'s role updated.`, 'success');
    } catch {
      toast.show('Failed to update role.', 'error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-2">Edit Role</h2>
        <p className="text-sm text-gray-500 mb-5">
          {target.first_name} {target.last_name} — {target.email}
        </p>
        {isSelf && (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You cannot modify your own role.
          </p>
        )}
        <div className="space-y-2">
          {ALL_ROLES.map((r) => {
            const disabledDemote = isLastSuperAdmin && target.role === 'super_admin' && r.value !== 'super_admin';
            const disabled = isSelf || disabledDemote;
            return (
              <label
                key={r.value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  role === r.value ? 'border-[#0FA3B1] bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => { if (!disabled) setRole(r.value); }}
                  disabled={disabled}
                  className="text-[#0FA3B1] focus:ring-[#0FA3B1]"
                />
                <span className="text-sm font-medium text-gray-700">{r.label}</span>
                {r.value === 'super_admin' && disabledDemote && (
                  <span className="ml-auto text-xs text-gray-400">last super admin</span>
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isSelf || role === target.role}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();
  const toast = useToast();

  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<PlatformAdminEntry[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<PlatformAdminEntry | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PlatformAdminEntry | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!adminUser) return;
    if (!can.manageSettings(adminUser.role)) router.replace('/');
  }, [adminUser, router]);

  useEffect(() => {
    platformConfig
      .list()
      .then(({ data }) => setConfigs(data))
      .catch(() => setConfigError('Failed to load config.'))
      .finally(() => setConfigLoading(false));

    platformAdmins
      .list()
      .then(({ data }) => setAdmins(data.data))
      .catch(() => setAdminsError('Failed to load admin users.'))
      .finally(() => setAdminsLoading(false));
  }, []);

  const activeSuperAdminCount = admins.filter(
    (a) => a.role === 'super_admin' && a.is_active
  ).length;

  function isLastSuperAdmin(target: PlatformAdminEntry): boolean {
    return target.role === 'super_admin' && activeSuperAdminCount <= 1;
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const { data } = await platformAdmins.updateStatus(deactivateTarget.id, false);
      setAdmins((prev) => prev.map((a) => (a.id === data.id ? data : a)));
      toast.show(`${deactivateTarget.first_name} deactivated.`, 'success');
      setDeactivateTarget(null);
    } catch {
      toast.show('Failed to update status.', 'error');
      setDeactivating(false);
    }
  }

  if (!adminUser || !can.manageSettings(adminUser.role)) return null;

  return (
    <div>
      <PageHeader title="Settings" />

      {/* ── Platform Config ──────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-heading text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings size={16} className="text-gray-400" />
          Platform Config
        </h2>

        {configError && <ErrorBanner message={configError} className="mb-4" />}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6">
          {configLoading ? (
            <div className="py-8 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-10 rounded" />
              ))}
            </div>
          ) : configs.length === 0 ? (
            <p className="py-8 text-sm text-gray-400 text-center">No config keys found.</p>
          ) : (
            configs.map((item) => (
              <ConfigRow
                key={item.config_key}
                item={item}
                onSaved={(updated) =>
                  setConfigs((prev) => prev.map((c) => (c.config_key === updated.config_key ? updated : c)))
                }
              />
            ))
          )}
        </div>
      </section>

      {/* ── Admin Users ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-semibold text-gray-900">Platform Admins</h2>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 min-h-[44px] px-4 bg-[#0FA3B1] text-white text-sm font-medium rounded-lg hover:bg-[#0d8f9c] transition-colors"
          >
            <Plus size={16} />
            Add Admin
          </button>
        </div>

        {adminsError && <ErrorBanner message={adminsError} className="mb-4" />}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {adminsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-14 rounded-xl" />
              ))}
            </div>
          ) : admins.length === 0 ? (
            <p className="py-8 text-sm text-gray-400 text-center">No admins found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {admin.first_name} {admin.last_name}
                      {admin.id === adminUser.id && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{admin.email}</div>
                  </div>
                  <RoleBadge role={admin.role} />
                  <span className={`text-xs ${admin.is_active ? 'text-teal-600' : 'text-gray-400'}`}>
                    {admin.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {admin.last_login_at && (
                    <span className="text-xs text-gray-400 hidden xl:block">
                      {formatDistanceToNow(new Date(admin.last_login_at), { addSuffix: true })}
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditRoleTarget(admin)}
                      disabled={admin.id === adminUser.id}
                      className="text-xs text-[#0FA3B1] hover:text-[#0d8f9c] px-2 py-1 rounded hover:bg-teal-50 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Edit role of ${admin.first_name}`}
                    >
                      Edit role
                    </button>
                    {admin.is_active && admin.id !== adminUser.id && (
                      <button
                        onClick={() => setDeactivateTarget(admin)}
                        disabled={isLastSuperAdmin(admin)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Deactivate ${admin.first_name}`}
                        title={isLastSuperAdmin(admin) ? 'Cannot deactivate last active super admin' : undefined}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {inviteOpen && (
        <InviteAdminModal
          onClose={() => setInviteOpen(false)}
          onCreated={(admin) => {
            setAdmins((prev) => [...prev, admin]);
            setInviteOpen(false);
          }}
        />
      )}

      {editRoleTarget && (
        <EditRoleModal
          target={editRoleTarget}
          isLastSuperAdmin={isLastSuperAdmin(editRoleTarget)}
          currentUserId={adminUser.id}
          onClose={() => setEditRoleTarget(null)}
          onSaved={(updated) => {
            setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setEditRoleTarget(null);
          }}
        />
      )}

      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate Admin"
          body={
            <>
              Deactivate <strong>{deactivateTarget.first_name} {deactivateTarget.last_name}</strong>? They will no longer be able to log in.
            </>
          }
          confirmLabel="Deactivate"
          destructive
          loading={deactivating}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}
