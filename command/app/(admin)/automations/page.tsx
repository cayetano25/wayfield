'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  platformAutomations,
  type AutomationRule,
  type Paginated,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import RuleEditorSlideOver from '@/components/RuleEditorSlideOver';
import { useToast } from '@/components/ui/Toast';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i}>
          <td colSpan={5} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300">
      Inactive
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();
  const toast = useToast();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [meta, setMeta] = useState<Omit<Paginated<AutomationRule>, 'data'> | null>(null);
  const [page, setPage] = useState(1);
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    if (!adminUser) return;
    if (!can.manageAutomations(adminUser.role)) router.replace('/');
  }, [adminUser, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof platformAutomations.list>[0] = { page };
    if (filterActive !== '') params.is_active = filterActive === 'true';
    platformAutomations
      .list(params)
      .then(({ data }) => {
        setRules(data.data);
        setMeta({ ...data, data: undefined as never });
      })
      .catch(() => setError('Failed to load automation rules.'))
      .finally(() => setLoading(false));
  }, [page, filterActive]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(rule: AutomationRule) {
    setToggling(rule.id);
    try {
      const { data } = await platformAutomations.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      toast.show(`Rule "${data.name}" ${data.is_active ? 'activated' : 'deactivated'}.`, 'success');
    } catch {
      toast.show('Failed to update rule.', 'error');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await platformAutomations.delete(deleteTarget.id);
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.show(`Rule "${deleteTarget.name}" deleted.`, 'success');
      setDeleteTarget(null);
    } catch {
      toast.show('Failed to delete rule.', 'error');
      setDeleting(false);
    }
  }

  function handleSaved(saved: AutomationRule) {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      return idx >= 0 ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
    });
    setEditorOpen(false);
    toast.show(`Rule "${saved.name}" ${editingRule ? 'updated' : 'created'}.`, 'success');
    setEditingRule(null);
  }

  if (!adminUser || !can.manageAutomations(adminUser.role)) return null;

  const totalPages = meta?.last_page ?? 1;

  return (
    <div>
      <PageHeader
        title="Automations"
        right={
          <button
            onClick={() => { setEditingRule(null); setEditorOpen(true); }}
            className="flex items-center gap-2 min-h-[44px] px-4 bg-[#0FA3B1] text-white text-sm font-medium rounded-lg hover:bg-[#0d8f9c] transition-colors"
          >
            <Plus size={16} />
            New Rule
          </button>
        }
      />

      {/* Engine notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Zap size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          The automation execution engine is not yet wired. Rules can be created and managed here, but they will not run automatically until the scheduler is implemented.
        </span>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} className="mb-6" />}

      {/* Filter bar */}
      <div className="mb-4 flex gap-3">
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value as '' | 'true' | 'false'); setPage(1); }}
          className="min-h-[44px] px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
        >
          <option value="">All Rules</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHead>
            <Th>Name</Th>
            <Th>Trigger</Th>
            <Th>Action</Th>
            <Th>Status</Th>
            <Th>Last Run</Th>
            <Th><span className="sr-only">Actions</span></Th>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <EmptyState
                    icon={Zap}
                    heading="No automation rules"
                    subtitle="Create a rule to automate platform actions."
                  />
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <Td>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    {rule.organization_name && (
                      <div className="text-xs text-gray-400">{rule.organization_name}</div>
                    )}
                  </Td>
                  <Td>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {rule.trigger_type}
                    </code>
                  </Td>
                  <Td>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {rule.action_type}
                    </code>
                  </Td>
                  <Td>
                    <StatusPill active={rule.is_active} />
                  </Td>
                  <Td className="text-gray-500 text-sm">
                    {rule.last_run_at
                      ? formatDistanceToNow(new Date(rule.last_run_at), { addSuffix: true })
                      : '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(rule)}
                        disabled={toggling === rule.id}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors min-h-[44px]"
                        aria-label={`Toggle ${rule.name}`}
                      >
                        {toggling === rule.id ? '…' : rule.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => { setEditingRule(rule); setEditorOpen(true); }}
                        className="text-xs text-[#0FA3B1] hover:text-[#0d8f9c] px-2 py-1 rounded hover:bg-teal-50 transition-colors min-h-[44px]"
                        aria-label={`Edit ${rule.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[44px]"
                        aria-label={`Delete ${rule.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="min-h-[44px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="flex items-center text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="min-h-[44px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      <RuleEditorSlideOver
        rule={editingRule}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingRule(null); }}
        onSaved={handleSaved}
      />

      {deleteTarget && (
        <ConfirmModal
          title="Delete Automation Rule"
          body={
            <>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
