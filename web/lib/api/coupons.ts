import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface Coupon {
  id: number;
  organization_id: number;
  workshop_id: number | null;
  workshop_title: string | null;
  code: string;
  label: string | null;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free';
  discount_pct: number | null;
  discount_amount_cents: number | null;
  discount_formatted: string;
  applies_to: 'all' | 'workshop_only' | 'addons_only';
  minimum_order_cents: number;
  minimum_order_formatted: string;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
  redemption_count: number;
  total_discount_given_cents: number;
  total_discount_given_formatted: string;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  recent_redemptions?: CouponRedemption[];
}

export interface CouponRedemption {
  id: number;
  order_number: string | null;
  user_name: string;
  discount_amount_cents: number;
  discount_amount_formatted: string;
  pre_discount_subtotal_cents: number;
  pre_discount_subtotal_formatted: string;
  post_discount_total_cents: number;
  post_discount_total_formatted: string;
  workshop_title: string | null;
  coupon_code_snapshot: string;
  discount_type_snapshot: string;
  created_at: string;
}

export interface CouponListResponse {
  data: Coupon[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

export interface CouponRedemptionListResponse {
  data: CouponRedemption[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

export interface CreateCouponPayload {
  code: string;
  label?: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free';
  discount_pct?: number;
  discount_amount_cents?: number;
  applies_to?: 'all' | 'workshop_only' | 'addons_only';
  workshop_id?: number | null;
  minimum_order_cents?: number;
  max_redemptions?: number | null;
  max_redemptions_per_user?: number;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

export type UpdateCouponPayload = Partial<CreateCouponPayload>;

export interface CouponFilters {
  is_active?: boolean;
  discount_type?: string;
  search?: string;
  page?: number;
}

export function listCoupons(
  organizationId: number,
  filters: CouponFilters = {},
): Promise<CouponListResponse> {
  const params = new URLSearchParams();
  if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters.discount_type) params.set('discount_type', filters.discount_type);
  if (filters.search) params.set('search', filters.search);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  const qs = params.toString();
  return apiGet(`/organizations/${organizationId}/coupons${qs ? `?${qs}` : ''}`);
}

export function getCoupon(organizationId: number, couponId: number): Promise<Coupon> {
  return apiGet(`/organizations/${organizationId}/coupons/${couponId}`);
}

export function createCoupon(
  organizationId: number,
  payload: CreateCouponPayload,
): Promise<Coupon> {
  return apiPost(`/organizations/${organizationId}/coupons`, payload);
}

export function updateCoupon(
  organizationId: number,
  couponId: number,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  return apiPatch(`/organizations/${organizationId}/coupons/${couponId}`, payload);
}

export function deactivateCoupon(
  organizationId: number,
  couponId: number,
): Promise<{ message: string }> {
  return apiDelete(`/organizations/${organizationId}/coupons/${couponId}`);
}

export function activateCoupon(organizationId: number, couponId: number): Promise<Coupon> {
  return apiPatch(`/organizations/${organizationId}/coupons/${couponId}`, { is_active: true });
}

export function getCouponRedemptions(
  organizationId: number,
  couponId: number,
  page = 1,
): Promise<CouponRedemptionListResponse> {
  const qs = page > 1 ? `?page=${page}` : '';
  return apiGet(`/organizations/${organizationId}/coupons/${couponId}/redemptions${qs}`);
}

export interface BulkGeneratePayload {
  count: number;
  prefix?: string;
  label: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free';
  discount_pct?: number;
  discount_amount_cents?: number;
  applies_to?: 'all' | 'workshop_only' | 'addons_only';
  workshop_id?: number | null;
  valid_until?: string | null;
}

export interface BulkGenerateResult {
  generated: number;
  failed: number;
  label: string;
  codes: string[];
  coupon_ids: number[];
}

export function bulkGenerateCoupons(
  organizationId: number,
  payload: BulkGeneratePayload,
): Promise<{ data: BulkGenerateResult }> {
  return apiPost(`/organizations/${organizationId}/coupons/bulk-generate`, payload);
}

export type AnalyticsPeriod = 'this_month' | 'last_month' | 'this_year' | 'all_time';

export interface CouponAnalyticsPerCoupon {
  coupon_id: number;
  code: string;
  label: string | null;
  discount_type: string;
  discount_display: string;
  redemption_count: number;
  total_discount: string;
  total_discount_cents: number;
  total_revenue: string;
}

export interface CouponAnalytics {
  period: AnalyticsPeriod;
  period_from: string;
  period_to: string;
  total_redemptions: number;
  total_discount: string;
  total_discount_cents: number;
  total_revenue: string;
  conversion_rate_pct: number;
  orders_with_coupon: number;
  total_orders: number;
  top_coupon: {
    coupon_id: number;
    code: string;
    label: string | null;
    use_count: number;
  } | null;
  per_coupon: CouponAnalyticsPerCoupon[];
}

export function getCouponAnalytics(
  organizationId: number,
  period: AnalyticsPeriod = 'this_month',
): Promise<{ data: CouponAnalytics }> {
  return apiGet(`/organizations/${organizationId}/coupons/analytics?period=${period}`);
}
