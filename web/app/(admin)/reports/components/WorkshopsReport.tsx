'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, BookOpen, FileEdit, Users, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getWorkshopsReport, type WorkshopsReportItem, type WorkshopsReport } from '@/lib/api/reports';

/* --- Helpers ----------------------------------------------------------- */

function fmtDate(s: string) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateRange(start: string, end: string) {
  if (!start) return '';
  if (!end || start === end) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function workshopStatusLabel(w: WorkshopsReportItem): { label: string; bg: string; color: string } {
  const today = new Date().toISOString().split('T')[0];
  if (w.status === 'draft') return { label: 'DRAFT', bg: '#F3F4F6', color: '#6B7280' };
  if (w.status === 'archived' || w.end_date < today) return { label: 'COMPLETED', bg: '#F3F4F6', color: '#6B7280' };
  if (w.start_date <= today && w.end_date >= today) return { label: 'LIVE', bg: '#D1FAE5', color: '#065F46' };
  return { label: 'UPCOMING', bg: '#EFF6FF', color: '#1D4ED8' };
}

function RatePill({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const bg = pct >= 80 ? '#D1FAE5' : pct >= 50 ? '#FEF3C7' : '#FEE2E2';
  const color = pct >= 80 ? '#065F46' : pct >= 50 ? '#92400E' : '#991B1B';
  return (
    <span className="inline-flex items-center font-sans font-semibold px-2 py-0.5 rounded-full"
      style={{ fontSize: 11, backgroundColor: bg, color }}>
      {pct}%
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub: string;
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
      <p className="font-heading font-semibold leading-none mb-1" style={{ fontSize: 32, color: '#2E2E2E' }}>
        {value}
      </p>
      <p className="font-sans font-medium" style={{ fontSize: 13, color: '#6B7280' }}>{sub}</p>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6', width: i === 1 ? 140 : 56 }} />
        </td>
      ))}
    </tr>
  );
}

/* --- WorkshopsReport --------------------------------------------------- */

interface WorkshopsReportProps {
  orgId: number;
}

export function WorkshopsReportTab({ orgId }: WorkshopsReportProps) {
  const router = useRouter();
  const [report, setReport] = useState<WorkshopsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchReport() {
    setLoading(true);
    setError(false);
    getWorkshopsReport(orgId)
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchReport(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <Card className="p-8 flex flex-col items-center text-center gap-4">
        <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
        <p className="font-heading font-semibold" style={{ color: '#2E2E2E' }}>Failed to load report</p>
        <Button variant="secondary" onClick={fetchReport}>Retry</Button>
      </Card>
    );
  }

  const { summary } = report ?? { summary: undefined };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="h-3 w-28 rounded animate-pulse mb-4" style={{ backgroundColor: '#F3F4F6' }} />
              <div className="h-9 w-20 rounded animate-pulse mb-2" style={{ backgroundColor: '#F3F4F6' }} />
              <div className="h-3 w-36 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6' }} />
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={LayoutGrid} label="Total Workshops" value={summary?.total ?? 0} sub="all time" />
            <StatCard icon={BookOpen} label="Published" value={summary?.published ?? 0} sub="live or upcoming" />
            <StatCard icon={FileEdit} label="Draft" value={summary?.draft ?? 0} sub="not yet published" />
            <StatCard icon={Users} label="Total Participants" value={(summary?.total_participants ?? 0).toLocaleString()} sub="across all workshops" />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="font-heading font-semibold" style={{ fontSize: 15, color: '#2E2E2E' }}>All Workshops</h2>
          {!loading && (
            <span className="font-sans text-xs" style={{ color: '#9CA3AF' }}>
              {report?.workshops?.length ?? 0} workshops
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
                {['Workshop', 'Type', 'Dates', 'Sessions', 'Leaders', 'Participants', 'Capacity', 'Rate'].map((h) => (
                  <th key={h} className="font-sans font-semibold uppercase text-left px-5 py-3"
                    style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#F9FAFB' }}>
              {loading ? (
                [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)
              ) : (report?.workshops ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center font-sans text-sm" style={{ color: '#9CA3AF' }}>
                    No workshops yet
                  </td>
                </tr>
              ) : (
                (report?.workshops ?? []).map((w) => {
                  const { label: statusLabel, bg: statusBg, color: statusColor } = workshopStatusLabel(w);
                  const enrolled = w.participants_count;
                  const cap = w.capacity;
                  const capacityStr = cap !== null ? `${enrolled}/${cap}` : 'Unlimited';

                  return (
                    <tr
                      key={w.id}
                      className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/workshops/${w.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-medium" style={{ color: '#2E2E2E' }}>
                            {w.title.length > 28 ? `${w.title.slice(0, 28)}…` : w.title}
                          </span>
                          <span
                            className="inline-flex items-center font-sans font-bold rounded-full px-2 py-0.5 shrink-0"
                            style={{ fontSize: 9, letterSpacing: '0.06em', backgroundColor: statusBg, color: statusColor }}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-sans whitespace-nowrap" style={{ color: '#6B7280' }}>
                        {w.workshop_type === 'session_based' ? 'Session' : 'Event'}
                      </td>
                      <td className="px-5 py-3.5 font-sans whitespace-nowrap" style={{ color: '#6B7280' }}>
                        {fmtDateRange(w.start_date, w.end_date)}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                        {w.sessions_count}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                        {w.leaders_count}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                        {w.participants_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 font-sans" style={{ color: cap !== null && enrolled >= cap ? '#E67E22' : '#374151' }}>
                        {capacityStr}
                      </td>
                      <td className="px-5 py-3.5">
                        <RatePill rate={w.attendance_rate} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
