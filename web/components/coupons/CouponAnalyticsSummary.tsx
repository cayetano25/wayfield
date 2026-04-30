'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  type AnalyticsPeriod,
  type CouponAnalytics,
  getCouponAnalytics,
} from '@/lib/api/coupons';

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
];

function Shimmer() {
  return <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />;
}

export function CouponAnalyticsSummary({ organizationId }: { organizationId: number }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('this_month');
  const [data, setData] = useState<CouponAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCouponAnalytics(organizationId, period)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load coupon analytics');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [organizationId, period]);

  return (
    <div className="mb-2">
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              period === p.value
                ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1 — Total Discount Given */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono] mb-1">
            Discount Given
          </p>
          {isLoading ? (
            <Shimmer />
          ) : (
            <p className="text-2xl font-bold text-gray-900 font-[Sora]">
              {data?.total_discount ?? '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            across {data?.total_redemptions ?? 0} redemption(s)
          </p>
        </div>

        {/* Card 2 — Conversion Rate */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono] mb-1">
            Coupon Conversion
          </p>
          {isLoading ? (
            <Shimmer />
          ) : (
            <p className="text-2xl font-bold text-gray-900 font-[Sora]">
              {data ? `${data.conversion_rate_pct}%` : '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {data?.orders_with_coupon ?? 0} of {data?.total_orders ?? 0} orders used a coupon
          </p>
        </div>

        {/* Card 3 — Top Coupon */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono] mb-1">
            Most Used
          </p>
          {isLoading ? (
            <Shimmer />
          ) : (
            <p className="text-2xl font-bold text-gray-900 font-mono">
              {data?.top_coupon?.code ?? '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {data?.top_coupon
              ? `${data.top_coupon.use_count} use(s) — ${data.top_coupon.label ?? ''}`
              : 'No redemptions yet'}
          </p>
        </div>

        {/* Card 4 — Revenue Through Coupons */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono] mb-1">
            Revenue (post-discount)
          </p>
          {isLoading ? (
            <Shimmer />
          ) : (
            <p className="text-2xl font-bold text-gray-900 font-[Sora]">
              {data?.total_revenue ?? '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">total collected from coupon orders</p>
        </div>
      </div>

      {/* Per-coupon breakdown table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">By Coupon</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Code', 'Discount', 'Uses', 'Given', 'Revenue'].map((h, i) => (
                <th
                  key={h}
                  className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono] ${
                    i >= 2 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  </div>
                </td>
              </tr>
            ) : data?.per_coupon && data.per_coupon.length > 0 ? (
              data.per_coupon.map((row) => (
                <tr key={row.coupon_id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span className="font-mono font-bold text-gray-900">{row.code}</span>
                    {row.label && (
                      <span className="text-xs text-gray-400 ml-2">{row.label}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{row.discount_display}</td>
                  <td className="px-5 py-3 text-right font-medium">{row.redemption_count}</td>
                  <td className="px-5 py-3 text-right text-green-600 font-medium">
                    {row.total_discount}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{row.total_revenue}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                  No coupon redemptions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
