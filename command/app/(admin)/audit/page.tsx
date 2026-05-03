'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ClipboardList, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { platformAuditLogs, type PlatformAuditLog } from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

// ─── Expandable row ───────────────────────────────────────────────────────────

function AuditRow({ log }: { log: PlatformAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = log.metadata_json;
  const hasMeta = meta && Object.keys(meta).length > 0;

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => { if (hasMeta) setExpanded((e) => !e); }}
      >
        <Td>
          <div className="flex items-center gap-2">
            {hasMeta ? (
              expanded
                ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                : <ChevronRight size={14} className="text-gray-400 shrink-0" />
            ) : <span className="w-[14px]" />}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
              {log.action}
            </code>
          </div>
        </Td>
        <Td className="text-sm text-gray-700">{log.admin_name ?? '—'}</Td>
        <Td className="text-sm text-gray-500">{log.organization_name ?? '—'}</Td>
        <Td className="text-sm text-gray-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
        </Td>
      </tr>
      {expanded && hasMeta && (
        <tr>
          <td colSpan={4} className="px-6 pb-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-1 gap-3">
              {meta.old !== undefined && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Previous</p>
                  <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(meta.old, null, 2)}
                  </pre>
                </div>
              )}
              {meta.new !== undefined && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">New</p>
                  <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(meta.new, null, 2)}
                  </pre>
                </div>
              )}
              {(meta.old === undefined && meta.new === undefined) && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Metadata</p>
                  <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i}>
          <td colSpan={4} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!adminUser) return;
    if (!can.viewAuditLog(adminUser.role)) router.replace('/');
  }, [adminUser, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    platformAuditLogs
      .list({ page })
      .then(({ data }) => {
        setLogs(data.data);
        setTotal(data.total);
        setLastPage(data.last_page);
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      // Fetch all pages of audit logs for export
      const allLogs: PlatformAuditLog[] = [];
      let p = 1;
      let maxPage = 1;
      do {
        const { data } = await platformAuditLogs.list({ page: p });
        allLogs.push(...data.data);
        maxPage = data.last_page;
        p++;
      } while (p <= maxPage && p <= 20); // cap at 20 pages for safety

      const header = 'id,action,admin_name,organization_name,ip_address,created_at';
      const rows = allLogs.map((log) =>
        [
          log.id,
          `"${log.action}"`,
          `"${log.admin_name ?? ''}"`,
          `"${log.organization_name ?? ''}"`,
          `"${log.ip_address ?? ''}"`,
          `"${log.created_at}"`,
        ].join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — CSV export is a best-effort convenience feature
    } finally {
      setExporting(false);
    }
  }

  if (!adminUser || !can.viewAuditLog(adminUser.role)) return null;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        right={
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 min-h-[44px] px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            aria-label="Export CSV"
          >
            <Download size={16} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} className="mb-6" />}

      {!loading && !error && (
        <p className="mb-4 text-sm text-gray-400">{total} event{total !== 1 ? 's' : ''}</p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHead>
            <tr>
              <Th>Action</Th>
              <Th>Admin</Th>
              <Th>Organization</Th>
              <Th>When</Th>
            </tr>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16">
                  <EmptyState
                    icon={<ClipboardList size={32} className="text-gray-400" />}
                    title="No audit events"
                    description="Platform activity will appear here."
                  />
                </td>
              </tr>
            ) : (
              logs.map((log) => <AuditRow key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
      </div>

      {lastPage > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="min-h-[44px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="flex items-center text-sm text-gray-600">
            Page {page} of {lastPage}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="min-h-[44px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
