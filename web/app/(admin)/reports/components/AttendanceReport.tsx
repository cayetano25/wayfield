'use client';

import React, { useEffect, useState } from 'react';
import { Users, CheckSquare, TrendingUp, TrendingDown, BarChart3, ChevronDown, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getAttendanceReport, type AttendanceReport, type AttendanceReportWorkshop, type AttendanceReportSession } from '@/lib/api/reports';

/* ─── Date helpers ────────────────────────────────────────────────────── */

function toIso(d: Date) { return d.toISOString().split('T')[0]; }
const todayStr = () => toIso(new Date());
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toIso(d); };
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

function fmtDate(s: string) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/* ─── Presets ─────────────────────────────────────────────────────────── */

const PRESETS = [
  { label: 'Last 7 days',  start: () => daysAgo(6),  end: todayStr },
  { label: 'Last 30 days', start: () => daysAgo(29), end: todayStr },
  { label: 'Last 90 days', start: () => daysAgo(89), end: todayStr },
  { label: 'This year',    start: startOfYear,        end: todayStr },
  { label: 'Custom',       start: () => daysAgo(29), end: todayStr },
];
const DEFAULT_PRESET = 1;

/* ─── Shared sub-components ───────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, valueColor }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  valueColor?: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
          <Icon className="w-4 h-4" style={{ color: '#0FA3B1' }} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest font-sans" style={{ color: '#9CA3AF' }}>
          {label}
        </p>
      </div>
      <p
        className="font-heading font-semibold leading-none mb-1"
        style={{ fontSize: 32, color: valueColor ?? '#2E2E2E' }}
      >
        {value}
      </p>
      <p className="font-sans font-medium" style={{ fontSize: 13, color: '#6B7280' }}>{sub}</p>
    </Card>
  );
}

function RatePill({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const bg = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2';
  const color = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
  return (
    <span
      className="inline-flex items-center font-sans font-semibold px-2 py-0.5 rounded-full"
      style={{ fontSize: 11, backgroundColor: bg, color }}
    >
      {pct}%
    </span>
  );
}

function SkeletonStatCard() {
  return (
    <Card className="p-6">
      <div className="h-3 w-28 rounded animate-pulse mb-4" style={{ backgroundColor: '#F3F4F6' }} />
      <div className="h-9 w-20 rounded animate-pulse mb-2" style={{ backgroundColor: '#F3F4F6' }} />
      <div className="h-3 w-36 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6' }} />
    </Card>
  );
}

/* ─── Workshop table ──────────────────────────────────────────────────── */

function WorkshopTable({ workshops }: { workshops: AttendanceReportWorkshop[] }) {
  const sorted = [...workshops].sort((a, b) =>
    (b.start_date ?? '').localeCompare(a.start_date ?? ''),
  );

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <h2 className="font-heading font-semibold" style={{ fontSize: 15, color: '#2E2E2E' }}>By Workshop</h2>
        <span className="font-sans text-xs" style={{ color: '#9CA3AF' }}>{workshops.length} workshops</span>
      </div>
      {sorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center px-8">
          <BarChart3 className="w-8 h-8 mb-3" style={{ color: '#D1D5DB' }} />
          <p className="font-heading font-semibold mb-1" style={{ color: '#2E2E2E' }}>No data for this period</p>
          <p className="font-sans text-sm" style={{ color: '#6B7280' }}>Try expanding the date range.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
                {['Workshop', 'Start Date', 'Registered', 'Checked In', 'No-Show', 'Rate'].map((h) => (
                  <th
                    key={h}
                    className="font-sans font-semibold uppercase text-left px-5 py-3"
                    style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((w, i) => (
                <tr
                  key={w.id}
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid #F9FAFB' : undefined }}
                  className="hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-sans font-medium" style={{ color: '#2E2E2E' }}>
                      {w.title.length > 28 ? `${w.title.slice(0, 28)}…` : w.title}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-sans" style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(w.start_date)}
                  </td>
                  <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                    {w.registered.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                    {w.checked_in.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#6B7280' }}>
                    {w.no_show.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <RatePill rate={w.rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ─── Session table (shown when a workshop is selected) ───────────────── */

function SessionTable({ sessions }: { sessions: AttendanceReportSession[] }) {
  const sorted = [...sessions].sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <h2 className="font-heading font-semibold" style={{ fontSize: 15, color: '#2E2E2E' }}>By Session</h2>
        <span className="font-sans text-xs" style={{ color: '#9CA3AF' }}>{sessions.length} sessions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
              {['Session', 'Date', 'Enrolled', 'Checked In', 'No-Show', 'Rate'].map((h) => (
                <th
                  key={h}
                  className="font-sans font-semibold uppercase text-left px-5 py-3"
                  style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr
                key={s.id}
                style={{ borderBottom: i < sorted.length - 1 ? '1px solid #F9FAFB' : undefined }}
                className="hover:bg-[#FAFAFA] transition-colors"
              >
                <td className="px-5 py-3.5 font-sans font-medium" style={{ color: '#2E2E2E' }}>{s.title}</td>
                <td className="px-5 py-3.5 font-sans" style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>
                  {fmtDate(s.start_at.split('T')[0])} · {fmtTime(s.start_at)}
                </td>
                <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>{s.enrolled}</td>
                <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>{s.checked_in}</td>
                <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#6B7280' }}>{s.no_show}</td>
                <td className="px-5 py-3.5"><RatePill rate={s.rate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── AttendanceReport ────────────────────────────────────────────────── */

interface AttendanceReportProps {
  orgId: number;
  workshopId?: number;
}

export function AttendanceReportTab({ orgId, workshopId }: AttendanceReportProps) {
  const [presetIdx, setPresetIdx] = useState(DEFAULT_PRESET);
  const [customStart, setCustomStart] = useState(daysAgo(29));
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [showMenu, setShowMenu] = useState(false);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isCustom = presetIdx === PRESETS.length - 1;
  const activeStart = isCustom ? customStart : PRESETS[presetIdx].start();
  const activeEnd   = isCustom ? customEnd   : PRESETS[presetIdx].end();

  useEffect(() => {
    setLoading(true);
    setError(false);
    getAttendanceReport(orgId, { start_date: activeStart, end_date: activeEnd, workshop_id: workshopId })
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orgId, workshopId, activeStart, activeEnd]);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const { summary } = report ?? { summary: undefined };

  const attendanceColor = !summary ? '#9CA3AF' :
    summary.attendance_rate >= 80 ? '#10B981' :
    summary.attendance_rate >= 50 ? '#F59E0B' : '#E94F37';

  const noShowColor = !summary ? '#9CA3AF' :
    summary.no_show_rate <= 10 ? '#10B981' :
    summary.no_show_rate <= 25 ? '#F59E0B' : '#E94F37';

  return (
    <div className="space-y-5">
      {/* Date range picker */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="h-10 pl-4 pr-3 flex items-center gap-2 bg-white border rounded-lg font-sans text-sm font-medium transition-colors hover:bg-[#F9FAFB]"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}
          >
            {PRESETS[presetIdx].label}
            <ChevronDown className="w-4 h-4" style={{ color: '#9CA3AF' }} />
          </button>
          {showMenu && (
            <div
              className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
              style={{ width: 160, border: '1px solid #E5E7EB' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setPresetIdx(i); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 font-sans text-sm transition-colors"
                  style={{
                    color: i === presetIdx ? '#0FA3B1' : '#374151',
                    backgroundColor: i === presetIdx ? '#EFF6FF' : 'transparent',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isCustom && (
          <>
            <div className="flex items-center gap-2">
              <label className="font-sans text-xs font-medium" style={{ color: '#6B7280' }}>From</label>
              <input type="date" value={customStart} max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 border rounded-lg font-sans text-sm bg-white focus:outline-none"
                style={{ borderColor: '#E5E7EB', color: '#374151' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-sans text-xs font-medium" style={{ color: '#6B7280' }}>To</label>
              <input type="date" value={customEnd} min={customStart} max={todayStr()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 px-3 border rounded-lg font-sans text-sm bg-white focus:outline-none"
                style={{ borderColor: '#E5E7EB', color: '#374151' }}
              />
            </div>
          </>
        )}

        {!isCustom && (
          <span className="font-sans text-sm" style={{ color: '#6B7280' }}>
            {fmtDate(activeStart)} — {fmtDate(activeEnd)}
          </span>
        )}
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : error ? (
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
          <p className="font-heading font-semibold" style={{ color: '#2E2E2E' }}>Failed to load report</p>
          <Button variant="secondary" onClick={() => {
            setLoading(true);
            setError(false);
            getAttendanceReport(orgId, { start_date: activeStart, end_date: activeEnd, workshop_id: workshopId })
              .then(setReport).catch(() => setError(true)).finally(() => setLoading(false));
          }}>Retry</Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard icon={Users} label="Total Registered" value={(summary?.total_registered ?? 0).toLocaleString()} sub="in selected period" />
            <StatCard icon={CheckSquare} label="Total Checked In" value={(summary?.total_checked_in ?? 0).toLocaleString()} sub="confirmed attendees" />
            <StatCard icon={TrendingUp} label="Attendance Rate" value={`${Math.round(summary?.attendance_rate ?? 0)}%`} sub="checked in vs registered" valueColor={attendanceColor} />
            <StatCard icon={TrendingDown} label="No-Show Rate" value={`${Math.round(summary?.no_show_rate ?? 0)}%`} sub="registered but absent" valueColor={noShowColor} />
          </div>

          <WorkshopTable workshops={report?.workshops ?? []} />

          {workshopId && (report?.sessions ?? []).length > 0 && (
            <SessionTable sessions={report!.sessions!} />
          )}
        </>
      )}
    </div>
  );
}
