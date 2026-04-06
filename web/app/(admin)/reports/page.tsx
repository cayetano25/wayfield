'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Users,
  CalendarDays,
  TrendingUp,
  LayoutGrid,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { getAttendanceReport, type AttendanceReport } from '@/lib/api/reports';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

/* ─── Date helpers ──────────────────────────────────────────────────────── */

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function today(): string {
  return toIsoDate(new Date());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDate(d);
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPercent(rate: number): string {
  return `${Math.round(rate)}%`;
}

/* ─── Presets ─────────────────────────────────────────────────────────── */

interface Preset {
  label: string;
  startDate: () => string;
  endDate: () => string;
}

const PRESETS: Preset[] = [
  { label: 'Last 7 days',  startDate: () => daysAgo(6),     endDate: today },
  { label: 'Last 30 days', startDate: () => daysAgo(29),    endDate: today },
  { label: 'Last 90 days', startDate: () => daysAgo(89),    endDate: today },
  { label: 'This year',    startDate: startOfYear,           endDate: today },
  { label: 'Custom',       startDate: () => daysAgo(29),    endDate: today },
];

const DEFAULT_PRESET = 1; // Last 30 days

/* ─── Skeleton components ───────────────────────────────────────────────── */

function SkeletonStatCard() {
  return (
    <Card className="p-6">
      <div className="h-3 w-28 bg-surface rounded animate-pulse mb-4" />
      <div className="h-9 w-20 bg-surface rounded animate-pulse mb-2" />
      <div className="h-3 w-36 bg-surface rounded animate-pulse" />
    </Card>
  );
}

function SkeletonTable() {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border-gray">
        <div className="h-4 w-40 bg-surface rounded animate-pulse" />
      </div>
      <div className="divide-y divide-border-gray">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="h-4 flex-1 bg-surface rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface rounded animate-pulse" />
            <div className="h-4 w-12 bg-surface rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface rounded animate-pulse" />
            <div className="h-5 w-20 bg-surface rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-light-gray font-sans">
          {label}
        </p>
      </div>
      <p className="font-heading text-[32px] font-semibold text-dark leading-none mb-1">
        {value}
      </p>
      <p className="text-[13px] font-medium text-medium-gray">{sub}</p>
    </Card>
  );
}

/* ─── Reports page ────────────────────────────────────────────────────── */

export default function ReportsPage() {
  useSetPage('Reports');

  const { currentOrg } = useUser();

  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET);
  const [customStart, setCustomStart] = useState(daysAgo(29));
  const [customEnd, setCustomEnd] = useState(today());
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isCustom = presetIndex === PRESETS.length - 1;

  const activeStart = isCustom ? customStart : PRESETS[presetIndex].startDate();
  const activeEnd   = isCustom ? customEnd   : PRESETS[presetIndex].endDate();

  function fetchReport(orgId: number, startDate: string, endDate: string) {
    setLoading(true);
    setError(false);
    getAttendanceReport(orgId, { start_date: startDate, end_date: endDate })
      .then((data) => setReport(data))
      .catch(() => {
        setError(true);
        toast.error('Failed to load report');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!currentOrg) return;
    fetchReport(currentOrg.id, activeStart, activeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, activeStart, activeEnd]);

  /* ── Preset menu close on outside click ── */
  useEffect(() => {
    if (!showPresetMenu) return;
    function close() { setShowPresetMenu(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showPresetMenu]);

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="h-10 w-48 bg-white rounded-lg border border-border-gray animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !report) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10 text-danger" />
          <div>
            <p className="font-heading font-semibold text-dark mb-1">Failed to load report</p>
            <p className="text-sm text-medium-gray">There was a problem fetching your reports. Please try again.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => currentOrg && fetchReport(currentOrg.id, activeStart, activeEnd)}
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { summary, workshops } = report;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* ── Date range picker ── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Preset selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresetMenu((v) => !v)}
            className="h-10 pl-4 pr-3 flex items-center gap-2 bg-white border border-border-gray rounded-lg text-sm font-medium text-dark hover:bg-surface transition-colors"
          >
            {PRESETS[presetIndex].label}
            <ChevronDown className="w-4 h-4 text-medium-gray" />
          </button>
          {showPresetMenu && (
            <div
              className="absolute top-full left-0 mt-1 w-40 bg-white border border-border-gray rounded-xl shadow-lg z-20 overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setPresetIndex(i); setShowPresetMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    i === presetIndex
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-dark hover:bg-surface'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom date inputs — visible only when "Custom" is selected */}
        {isCustom && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-medium-gray font-medium">From</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 border border-border-gray rounded-lg text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-medium-gray font-medium">To</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 px-3 border border-border-gray rounded-lg text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </>
        )}

        {/* Date range label */}
        {!isCustom && (
          <span className="text-sm text-medium-gray">
            {formatDate(activeStart)} — {formatDate(activeEnd)}
          </span>
        )}
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          icon={Users}
          label="Total Participants"
          value={summary.total_participants.toLocaleString()}
          sub="registered in selected period"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Attendance Rate"
          value={formatPercent(summary.avg_attendance_rate)}
          sub="across all sessions"
        />
        <StatCard
          icon={CalendarDays}
          label="Total Sessions"
          value={summary.total_sessions.toLocaleString()}
          sub="published sessions"
        />
        <StatCard
          icon={LayoutGrid}
          label="Workshops Run"
          value={summary.workshops_run.toLocaleString()}
          sub="in selected period"
        />
      </div>

      {/* ── Workshop breakdown table ── */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-dark">Workshop Breakdown</h2>
          <span className="text-xs text-medium-gray">{workshops.length} workshops</span>
        </div>

        {workshops.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center px-8">
            <div className="w-14 h-14 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-light-gray" />
            </div>
            <p className="font-heading font-semibold text-dark mb-1">No data for this period</p>
            <p className="text-sm text-medium-gray max-w-xs">
              No workshops ran in the selected date range. Try expanding the date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-gray bg-surface/50">
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray sticky left-0 bg-surface/50 min-w-[200px]">
                    Workshop
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray whitespace-nowrap">
                    Participants
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray whitespace-nowrap">
                    Sessions
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray whitespace-nowrap">
                    Attendance Rate
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray whitespace-nowrap">
                    Date Range
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-light-gray">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-gray">
                {workshops.map((w) => (
                  <tr key={w.id} className="hover:bg-surface/60 transition-colors">
                    {/* Workshop title — sticky first column on mobile */}
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-surface/60">
                      <span className="font-medium text-dark line-clamp-1">{w.title}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-medium-gray">
                      {w.participant_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right text-medium-gray">
                      {w.session_count}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <AttendanceBar rate={w.avg_attendance_rate} />
                    </td>
                    <td className="px-4 py-4 text-medium-gray whitespace-nowrap">
                      {formatDate(w.start_date)}
                      {w.end_date && w.end_date !== w.start_date
                        ? ` — ${formatDate(w.end_date)}`
                        : ''}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={`status-${w.status}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Attendance rate bar ──────────────────────────────────────────────── */

function AttendanceBar({ rate }: { rate: number }) {
  const pct = Math.min(Math.round(rate), 100);
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-primary' :
    pct >= 25 ? 'bg-secondary' :
    'bg-danger';

  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-medium-gray tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}
