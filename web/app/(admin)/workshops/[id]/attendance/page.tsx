'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList, UserCheck, UserX } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Workshop {
  id: number;
  title: string;
  timezone: string;
}

interface Session {
  id: number;
  title: string;
  start_at: string;
}

type AttendanceStatus = 'not_checked_in' | 'checked_in' | 'no_show';
type CheckInMethod = 'self' | 'leader';

interface RosterEntry {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  status: AttendanceStatus;
  checked_in_at: string | null;
  check_in_method: CheckInMethod | null;
}

interface SessionSummary {
  session_id: number;
  session_title: string;
  total_registered: number;
  checked_in: number;
  no_show: number;
  pending: number;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const PHONE_VISIBLE_ROLES = ['owner', 'admin', 'staff'] as const;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

/* ─── Status badge ───────────────────────────────────────────────────── */

const statusLabel: Record<AttendanceStatus, string> = {
  not_checked_in: 'Pending',
  checked_in:     'Checked In',
  no_show:        'No Show',
};

const statusClasses: Record<AttendanceStatus, string> = {
  not_checked_in: 'bg-surface text-medium-gray',
  checked_in:     'bg-emerald-100 text-emerald-700',
  no_show:        'bg-danger/10 text-danger',
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
      {statusLabel[status]}
    </span>
  );
}

/* ─── Method badge ───────────────────────────────────────────────────── */

function MethodBadge({ method }: { method: CheckInMethod | null }) {
  if (!method) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info capitalize">
      {method === 'self' ? 'Self' : 'Leader'}
    </span>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────── */

function StatCard({
  label,
  count,
  total,
  accent,
}: {
  label: string;
  count: number;
  total: number;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-border-gray px-4 py-3 flex flex-col gap-1">
      <span className="text-xs font-medium text-medium-gray uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-heading font-semibold ${accent}`}>{count}</span>
        <span className="text-xs text-light-gray">{pct(count, total)}</span>
      </div>
    </div>
  );
}

/* ─── Bar chart ──────────────────────────────────────────────────────── */

function AttendanceChart({ data }: { data: SessionSummary[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.total_registered), 1);

  return (
    <div className="bg-white rounded-xl border border-border-gray p-6">
      <h3 className="font-heading font-semibold text-dark text-sm mb-5">
        Session Fill vs Attendance
      </h3>
      <div className="space-y-4">
        {data.map((d) => (
          <div key={d.session_id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark font-medium truncate max-w-[60%]">{d.session_title}</span>
              <span className="text-medium-gray shrink-0 ml-2">
                {d.checked_in}/{d.total_registered} checked in
              </span>
            </div>
            {/* Registered bar */}
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/30 rounded-full"
                style={{ width: `${(d.total_registered / maxVal) * 100}%` }}
              />
            </div>
            {/* Checked-in bar */}
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(d.checked_in / maxVal) * 100}%` }}
              />
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-medium-gray">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary/30 inline-block" />
                Registered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                Checked In
              </span>
              {d.no_show > 0 && (
                <span className="text-danger">
                  {d.no_show} no-show{d.no_show !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Roster table ───────────────────────────────────────────────────── */

function RosterTable({
  roster,
  timezone,
  showPhone,
  onCheckIn,
  onNoShow,
  actioning,
}: {
  roster: RosterEntry[];
  timezone: string;
  showPhone: boolean;
  onCheckIn: (userId: number) => void;
  onNoShow: (userId: number) => void;
  actioning: Set<number>;
}) {
  function formatCheckinTime(utcStr: string): string {
    try {
      return formatInTimeZone(new Date(utcStr), timezone, 'h:mm a');
    } catch {
      return utcStr;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border-gray overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-gray bg-surface">
            <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
              Name
            </th>
            {showPhone && (
              <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
                Phone
              </th>
            )}
            <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
              Status
            </th>
            <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
              Check-in Time
            </th>
            <th className="text-left px-4 py-3 font-medium text-medium-gray text-xs uppercase tracking-wide">
              Method
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-gray">
          {roster.map((entry) => {
            const rowTint =
              entry.status === 'checked_in'
                ? 'bg-emerald-50/60'
                : entry.status === 'no_show'
                ? 'bg-danger/5'
                : '';
            const isBusy = actioning.has(entry.user_id);

            return (
              <tr key={entry.user_id} className={`${rowTint} transition-colors`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 select-none">
                      {`${entry.first_name[0] ?? ''}${entry.last_name[0] ?? ''}`.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-dark">
                        {entry.first_name} {entry.last_name}
                      </p>
                      <p className="text-xs text-medium-gray truncate">{entry.email}</p>
                    </div>
                  </div>
                </td>
                {showPhone && (
                  <td className="px-4 py-3 text-medium-gray">
                    {entry.phone_number ?? <span className="text-light-gray">—</span>}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="px-4 py-3 text-medium-gray font-mono text-xs">
                  {entry.checked_in_at ? formatCheckinTime(entry.checked_in_at) : '—'}
                </td>
                <td className="px-4 py-3">
                  <MethodBadge method={entry.check_in_method} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {entry.status !== 'checked_in' && (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isBusy}
                        onClick={() => onCheckIn(entry.user_id)}
                        className="whitespace-nowrap"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Check In
                      </Button>
                    )}
                    {entry.status !== 'no_show' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={isBusy}
                        onClick={() => onNoShow(entry.user_id)}
                        className="whitespace-nowrap text-danger hover:bg-danger/5 hover:text-danger"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        No Show
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */

export default function WorkshopAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();
  const { currentOrg } = useUser();

  const showPhone = PHONE_VISIBLE_ROLES.includes(
    (currentOrg?.role ?? '') as typeof PHONE_VISIBLE_ROLES[number],
  );

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [summaryData, setSummaryData] = useState<SessionSummary[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [actioning, setActioning] = useState<Set<number>>(new Set());

  // Initial load: workshop + sessions + summary
  useEffect(() => {
    async function init() {
      try {
        const [wRes, sRes, sumRes] = await Promise.all([
          apiGet<Workshop>(`/workshops/${id}`),
          apiGet<Session[]>(`/workshops/${id}/sessions`),
          apiGet<SessionSummary[]>(`/workshops/${id}/attendance-summary`).catch(() => []),
        ]);
        setWorkshop(wRes);
        setSessions(sRes ?? []);
        setSummaryData(sumRes ?? []);
      } catch {
        toast.error('Failed to load attendance data');
      }
    }
    init();
  }, [id]);

  useEffect(() => {
    const title = workshop?.title ?? 'Workshop';
    setPage(title, [
      { label: 'Workshops', href: '/workshops' },
      { label: title, href: `/workshops/${id}` },
      { label: 'Attendance' },
    ]);
  }, [workshop, id, setPage]);

  // Load roster when session selected
  const loadRoster = useCallback(async (sessionId: number) => {
    setLoadingRoster(true);
    try {
      const res = await apiGet<RosterEntry[]>(`/sessions/${sessionId}/roster`);
      setRoster(res ?? []);
    } catch {
      toast.error('Failed to load roster');
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId != null) {
      loadRoster(selectedSessionId);
    }
  }, [selectedSessionId, loadRoster]);

  async function handleCheckIn(userId: number) {
    if (!selectedSessionId) return;
    setActioning((prev) => new Set(prev).add(userId));
    try {
      await apiPost(`/sessions/${selectedSessionId}/attendance/${userId}/leader-check-in`);
      setRoster((prev) =>
        prev.map((r) =>
          r.user_id === userId
            ? { ...r, status: 'checked_in', checked_in_at: new Date().toISOString(), check_in_method: 'leader' }
            : r,
        ),
      );
      toast.success('Participant checked in');
    } catch {
      toast.error('Failed to check in participant');
    } finally {
      setActioning((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    }
  }

  async function handleNoShow(userId: number) {
    if (!selectedSessionId) return;
    setActioning((prev) => new Set(prev).add(userId));
    try {
      await apiPost(`/sessions/${selectedSessionId}/attendance/${userId}/no-show`);
      setRoster((prev) =>
        prev.map((r) =>
          r.user_id === userId
            ? { ...r, status: 'no_show', checked_in_at: null, check_in_method: null }
            : r,
        ),
      );
      toast.success('Marked as no-show');
    } catch {
      toast.error('Failed to mark no-show');
    } finally {
      setActioning((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    }
  }

  // Summary stats for selected session
  const total   = roster.length;
  const checkedIn = roster.filter((r) => r.status === 'checked_in').length;
  const noShow    = roster.filter((r) => r.status === 'no_show').length;
  const pending   = roster.filter((r) => r.status === 'not_checked_in').length;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Session selector */}
      <div className="flex items-center gap-4">
        <div className="w-72">
          <Select
            value={selectedSessionId ?? ''}
            onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select a session to view roster</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </div>
        {selectedSessionId && total > 0 && (
          <span className="text-sm text-medium-gray">{total} registered</span>
        )}
      </div>

      {/* Roster section */}
      {selectedSessionId != null && (
        <>
          {loadingRoster ? (
            <div className="h-48 bg-white rounded-xl border border-border-gray animate-pulse" />
          ) : roster.length === 0 ? (
            <Card className="py-16 px-8 flex flex-col items-center text-center">
              <ClipboardList className="w-8 h-8 text-light-gray mb-3" />
              <p className="text-sm text-medium-gray">No participants registered for this session.</p>
            </Card>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total"      count={total}     total={total} accent="text-dark" />
                <StatCard label="Checked In" count={checkedIn} total={total} accent="text-emerald-600" />
                <StatCard label="No Show"    count={noShow}    total={total} accent="text-danger" />
                <StatCard label="Pending"    count={pending}   total={total} accent="text-amber-600" />
              </div>

              {/* Roster table */}
              <RosterTable
                roster={roster}
                timezone={workshop?.timezone ?? 'UTC'}
                showPhone={showPhone}
                onCheckIn={handleCheckIn}
                onNoShow={handleNoShow}
                actioning={actioning}
              />
            </>
          )}
        </>
      )}

      {/* No session selected hint */}
      {selectedSessionId == null && sessions.length > 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <ClipboardList className="w-10 h-10 text-light-gray mb-3" />
          <p className="text-sm text-medium-gray">Select a session above to view the roster and manage attendance.</p>
        </div>
      )}

      {/* Summary chart — across all sessions */}
      {summaryData.length > 0 && <AttendanceChart data={summaryData} />}
    </div>
  );
}
