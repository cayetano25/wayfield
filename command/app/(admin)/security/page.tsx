'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  platformSecurity,
  type SecurityEvent,
  type SecuritySeverity,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

// ─── Severity badge ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<SecuritySeverity, string> = {
  low:      'bg-gray-100 text-gray-600 ring-gray-200',
  medium:   'bg-blue-50 text-blue-700 ring-blue-200',
  high:     'bg-amber-50 text-amber-700 ring-amber-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
};

function SeverityBadge({ severity }: { severity: SecuritySeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium}`}
    >
      {severity}
    </span>
  );
}

// ─── Severity multi-select ────────────────────────────────────────────────────

const SEVERITY_OPTIONS: SecuritySeverity[] = ['low', 'medium', 'high', 'critical'];

interface SeverityFilterProps {
  selected: SecuritySeverity[];
  onChange: (s: SecuritySeverity[]) => void;
}

function SeverityFilter({ selected, onChange }: SeverityFilterProps) {
  const [open, setOpen] = useState(false);

  function toggle(s: SecuritySeverity) {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 min-h-[44px] px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 transition-colors"
      >
        Severity
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0FA3B1] text-white text-xs font-medium">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {SEVERITY_OPTIONS.map((s) => (
            <label
              key={s}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer min-h-[44px]"
            >
              <input
                type="checkbox"
                checked={selected.includes(s)}
                onChange={() => toggle(s)}
                className="rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <span className="capitalize">{s}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Expandable row ───────────────────────────────────────────────────────────

function EventRow({ event }: { event: SecurityEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = event.metadata_json && Object.keys(event.metadata_json).length > 0;

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => { if (hasMetadata) setExpanded((e) => !e); }}
      >
        <Td>
          <div className="flex items-center gap-2">
            {hasMetadata ? (
              expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />
            ) : <span className="w-[14px]" />}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
              {event.event_type}
            </code>
          </div>
        </Td>
        <Td><SeverityBadge severity={event.severity} /></Td>
        <Td className="text-sm text-gray-600 max-w-xs truncate">{event.description ?? '—'}</Td>
        <Td className="text-sm text-gray-500">{event.organization_name ?? '—'}</Td>
        <Td className="text-sm text-gray-500">{event.user_email ?? '—'}</Td>
        <Td className="text-sm text-gray-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </Td>
      </tr>
      {expanded && hasMetadata && (
        <tr>
          <td colSpan={6} className="px-6 pb-4 bg-gray-50 border-b border-gray-100">
            <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(event.metadata_json, null, 2)}
            </pre>
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
          <td colSpan={6} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [severities, setSeverities] = useState<SecuritySeverity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUser) return;
    if (!can.viewSecurity(adminUser.role)) router.replace('/');
  }, [adminUser, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof platformSecurity.listEvents>[0] = { page };
    if (severities.length > 0) params.severity = severities.join(',');
    platformSecurity
      .listEvents(params)
      .then(({ data }) => {
        setEvents(data.data);
        setTotal(data.total);
        setLastPage(data.last_page);
      })
      .catch(() => setError('Failed to load security events.'))
      .finally(() => setLoading(false));
  }, [page, severities]);

  useEffect(() => { load(); }, [load]);

  if (!adminUser || !can.viewSecurity(adminUser.role)) return null;

  return (
    <div>
      <PageHeader title="Security Events" />

      {error && <ErrorBanner message={error} onRetry={load} className="mb-6" />}

      {/* Filter bar */}
      <div className="mb-4 flex gap-3">
        <SeverityFilter
          selected={severities}
          onChange={(s) => { setSeverities(s); setPage(1); }}
        />
        {severities.length > 0 && (
          <button
            onClick={() => { setSeverities([]); setPage(1); }}
            className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] px-3"
          >
            Clear filters
          </button>
        )}
        {!loading && (
          <span className="flex items-center text-sm text-gray-400 ml-auto">
            {total} event{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHead>
            <Th>Event Type</Th>
            <Th>Severity</Th>
            <Th>Description</Th>
            <Th>Organization</Th>
            <Th>User</Th>
            <Th>When</Th>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <EmptyState
                    icon={<ShieldAlert size={32} className="text-gray-400" />}
                    title="No security events"
                    description={severities.length > 0 ? 'No events match the selected filters.' : 'No security events recorded yet.'}
                  />
                </td>
              </tr>
            ) : (
              events.map((event) => <EventRow key={event.id} event={event} />)
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
