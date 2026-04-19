'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getRegistrationTrend, type TrendPoint } from '@/lib/api/reports';
import { ReportLockedState } from './ReportLockedState';

/* --- Helpers ----------------------------------------------------------- */

function toIso(d: Date) { return d.toISOString().split('T')[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toIso(d); }
const todayStr = () => toIso(new Date());

function fmtWeek(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* --- Range options ----------------------------------------------------- */

const RANGES = [
  { label: 'Last 4 weeks',  start: () => daysAgo(27) },
  { label: 'Last 12 weeks', start: () => daysAgo(83) },
  { label: 'Last 6 months', start: () => daysAgo(181) },
];

/* --- RegistrationTrend ------------------------------------------------- */

interface RegistrationTrendProps {
  orgId: number;
  isProPlus: boolean;
}

export function RegistrationTrendTab({ orgId, isProPlus }: RegistrationTrendProps) {
  if (!isProPlus) {
    return (
      <ReportLockedState
        requiredPlan="pro"
        feature="Registration Trend"
        description="Registration Trend shows week-over-week growth across your workshops. Available on the Pro plan."
      />
    );
  }

  return <TrendChart orgId={orgId} />;
}

function TrendChart({ orgId }: { orgId: number }) {
  const [rangeIdx, setRangeIdx] = useState(1); // default: Last 12 weeks
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchTrend(idx: number) {
    setLoading(true);
    setError(false);
    getRegistrationTrend(orgId, { start_date: RANGES[idx].start(), end_date: todayStr() })
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchTrend(rangeIdx); }, [orgId, rangeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = data.map((pt) => ({
    name: fmtWeek(pt.week_start),
    registrations: pt.registrations,
  }));

  const allZero = chartData.length > 0 && chartData.every((d) => d.registrations === 0);

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading font-semibold" style={{ fontSize: 16, color: '#2E2E2E' }}>
          Registrations over time
        </h2>
        {/* Range selector */}
        <div className="flex items-center gap-1.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              className="font-sans font-semibold rounded-lg transition-colors"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                backgroundColor: i === rangeIdx ? '#0FA3B1' : 'white',
                color: i === rangeIdx ? 'white' : '#6B7280',
                border: '1px solid',
                borderColor: i === rangeIdx ? '#0FA3B1' : '#E5E7EB',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div
          className="w-full rounded-xl animate-pulse"
          style={{ height: 320, backgroundColor: '#F3F4F6' }}
        />
      ) : error ? (
        <div className="flex flex-col items-center text-center gap-4 py-12">
          <AlertCircle className="w-8 h-8" style={{ color: '#E94F37' }} />
          <p className="font-sans text-sm" style={{ color: '#6B7280' }}>Failed to load trend data</p>
          <Button variant="secondary" onClick={() => fetchTrend(rangeIdx)}>Retry</Button>
        </div>
      ) : allZero || chartData.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 320 }}>
          <p className="font-sans text-sm" style={{ color: '#9CA3AF' }}>
            No registrations in this period
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              formatter={(value: number | string | readonly (number | string)[] | undefined) =>
                [`${Array.isArray(value) ? value[0] : (value ?? 0)} registrations`, ''] as [string, string]
              }
              labelFormatter={(label: React.ReactNode) => `Week of ${label}`}
            />
            <Line
              type="monotone"
              dataKey="registrations"
              stroke="#0FA3B1"
              strokeWidth={2.5}
              dot={{ fill: '#0FA3B1', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#0FA3B1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
