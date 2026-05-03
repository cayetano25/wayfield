'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Building2, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { platformOrganizations, type OrgListItem, type PlanCode } from '@/lib/platform-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PlanBadge } from '@/components/ui/PlanBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

const PLAN_OPTIONS: Array<{ value: PlanCode; label: string }> = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'creator', label: 'Creator' },
  { value: 'studio', label: 'Studio' },
  { value: 'enterprise', label: 'Enterprise' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

// ─── Plan filter dropdown ─────────────────────────────────────────────────────

interface PlanFilterProps {
  selected: PlanCode[];
  onChange: (plans: PlanCode[]) => void;
}

function PlanFilter({ selected, onChange }: PlanFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(plan: PlanCode) {
    if (selected.includes(plan)) onChange(selected.filter((p) => p !== plan));
    else onChange([...selected, plan]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 min-h-[44px] px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 transition-colors"
      >
        Plan
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0FA3B1] text-white text-xs font-medium">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {PLAN_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer min-h-[44px]"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i}>
          <td colSpan={7} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-12 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = searchParams.get('search') ?? '';
  const planParam = searchParams.get('plan') ?? '';
  const statusParam = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const selectedPlans: PlanCode[] = planParam
    ? (planParam.split(',') as PlanCode[]).filter(Boolean)
    : [];

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.replace(`/organizations?${params.toString()}`);
  }

  function setSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam('search', value), 300);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformOrganizations.list({
        search: search || undefined,
        plan: selectedPlans.length === 1 ? selectedPlans[0] : undefined,
        status: statusParam || undefined,
        page,
      });
      setOrgs(data.data);
      setTotal(data.total);
      setLastPage(data.last_page);
    } catch {
      setError('Failed to load organisations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, planParam, statusParam, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to = Math.min(page * 25, total);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Organisations"
        subtitle={total > 0 ? `${total.toLocaleString()} total` : undefined}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            defaultValue={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full min-h-[44px] pl-9 pr-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
          />
        </div>

        {/* Plan filter */}
        <PlanFilter
          selected={selectedPlans}
          onChange={(plans) => setParam('plan', plans.join(','))}
        />

        {/* Status filter */}
        <select
          value={statusParam}
          onChange={(e) => setParam('status', e.target.value)}
          className="min-h-[44px] px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] appearance-none pr-8"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Table */}
      {!error && (
        <Table>
          <TableHead>
            <Th>Name</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
            <Th>Participants</Th>
            <Th>Workshops</Th>
            <Th>Last Active</Th>
            <Th><span className="sr-only">Actions</span></Th>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Building2}
                    heading="No organisations found"
                    subtitle="Try adjusting your filters."
                  />
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                  <Td>
                    <Link
                      href={`/organizations/${org.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-[#0FA3B1] transition-colors"
                    >
                      {org.name}
                    </Link>
                  </Td>
                  <Td>
                    <PlanBadge plan={org.subscription?.plan_code ?? 'foundation'} />
                  </Td>
                  <Td>
                    <StatusBadge status={org.status} />
                  </Td>
                  <Td>
                    <span
                      className="text-sm text-gray-600"
                      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    >
                      —
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="text-sm text-gray-600"
                      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    >
                      {org.active_workshops_count}/{org.workshops_count}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-400">
                      {formatDistanceToNow(new Date(org.updated_at), { addSuffix: true })}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/organizations/${org.id}`}
                      className="block min-h-[44px] flex items-center text-sm font-medium text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
                    >
                      View →
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Showing {from}–{to} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setParam('page', String(page - 1))}
              disabled={page <= 1}
              className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setParam('page', String(page + 1))}
              disabled={page >= lastPage}
              className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
