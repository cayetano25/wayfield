'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { formatCents } from '@/lib/utils/currency';

interface RedemptionCoupon {
  id: number;
  code: string;
  label: string | null;
  discount_type: string;
  discount_pct: number | null;
  discount_amount_cents: number | null;
}

interface RedemptionUser {
  id: number;
  first_name: string;
  last_name: string;
}

interface RedemptionOrder {
  id: number;
  order_number: string;
  total_cents: number;
}

interface WorkshopRedemption {
  id: number;
  coupon: RedemptionCoupon;
  user: RedemptionUser;
  order: RedemptionOrder | null;
  discount_amount_cents: number;
  post_discount_total_cents: number;
  created_at: string;
}

interface RedemptionSummary {
  total_redemptions: number;
  total_discount: string;
  total_discount_cents: number;
  unique_coupons_used: number;
}

interface RedemptionMeta {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
  summary: RedemptionSummary;
}

interface WorkshopRedemptionsResponse {
  data: WorkshopRedemption[];
  meta: RedemptionMeta;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  workshopId: string | number;
  workshopTitle: string;
}

export function WorkshopCouponRedemptions({ workshopId }: Props) {
  const [data, setData] = useState<WorkshopRedemption[]>([]);
  const [meta, setMeta] = useState<RedemptionMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    try {
      const qs = p > 1 ? `?page=${p}` : '';
      const res = await apiGet<WorkshopRedemptionsResponse>(
        `/workshops/${workshopId}/coupon-redemptions${qs}`,
      );
      setData(res.data);
      setMeta(res.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [workshopId]);

  useEffect(() => { load(page); }, [load, page]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 py-4">
        Failed to load coupon redemptions.{' '}
        <button
          type="button"
          className="underline"
          onClick={() => load(page)}
        >
          Retry
        </button>
      </p>
    );
  }

  if (!meta || data.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-400">
        No coupon codes have been used for this workshop yet.
      </div>
    );
  }

  const { summary } = meta;

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center gap-6 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Redemptions</span>
          <span className="font-semibold text-gray-900 ml-2">{summary.total_redemptions}</span>
        </div>
        <div>
          <span className="text-gray-400">Total discount given</span>
          <span className="font-semibold text-green-600 ml-2">{summary.total_discount}</span>
        </div>
        <div>
          <span className="text-gray-400">Unique codes used</span>
          <span className="font-semibold text-gray-900 ml-2">{summary.unique_coupons_used}</span>
        </div>
      </div>

      {/* Redemption table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Participant</th>
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Code</th>
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Order</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Discount</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Paid</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide font-[JetBrains_Mono]">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="py-3 text-gray-900">
                  {r.user.first_name} {r.user.last_name}
                </td>
                <td className="py-3">
                  <span className="font-mono font-bold text-gray-900">{r.coupon.code}</span>
                  {r.coupon.label && (
                    <span className="text-xs text-gray-400 ml-1.5">{r.coupon.label}</span>
                  )}
                </td>
                <td className="py-3 text-gray-500 font-mono text-xs">
                  {r.order?.order_number ?? '—'}
                </td>
                <td className="py-3 text-right text-green-600 font-medium">
                  — {formatCents(r.discount_amount_cents)}
                </td>
                <td className="py-3 text-right font-medium text-gray-900">
                  {formatCents(r.post_discount_total_cents)}
                </td>
                <td className="py-3 text-right text-gray-400 text-xs">
                  {formatRelativeDate(r.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <button
            type="button"
            disabled={page >= meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
