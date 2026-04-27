import { apiGet, apiPost } from './client';

export type RefundRequestStatus = 'pending' | 'approved' | 'denied' | 'auto_approved';

export const REASON_CODES = [
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'medical_reason', label: 'Medical reason' },
  { value: 'dissatisfied', label: 'Dissatisfied' },
  { value: 'other', label: 'Other — Describe below' },
] as const;

export type RefundReasonCode = (typeof REASON_CODES)[number]['value'];

export interface RefundTransaction {
  id: number;
  amount_cents: number;
  currency: string;
  stripe_refund_id: string | null;
  status: string;
  created_at: string;
}

export interface RefundRequestUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RefundRequest {
  id: number;
  order_id: number;
  order_item_id: number | null;
  requested_by_user_id: number;
  requested_by?: RefundRequestUser;
  reason_code: string;
  reason_text: string | null;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  status: RefundRequestStatus;
  auto_eligible: boolean;
  policy_applied_scope: string | null;
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  processed_at: string | null;
  created_at: string;
  order?: {
    id: number;
    order_number: string;
    total_cents: number;
    currency: string;
    organization_id: number;
    workshop_title?: string;
    user?: RefundRequestUser;
  };
  refund_transactions: RefundTransaction[];
}

export interface OrgRefundRequestsResponse {
  data: RefundRequest[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export function createRefundRequest(
  orderNumber: string,
  payload: {
    reason_code: string;
    reason_text?: string;
    requested_amount_cents: number;
    order_item_id?: number;
  },
): Promise<RefundRequest> {
  return apiPost(`/orders/${orderNumber}/refund-requests`, payload);
}

export function getOrderRefundRequests(orderNumber: string): Promise<RefundRequest[]> {
  return apiGet(`/orders/${orderNumber}/refund-requests`);
}

export function getOrgRefundRequests(
  organizationId: number,
  params?: { status?: string; date_from?: string; date_to?: string; page?: number },
): Promise<OrgRefundRequestsResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.date_from) search.set('date_from', params.date_from);
  if (params?.date_to) search.set('date_to', params.date_to);
  if (params?.page) search.set('page', String(params.page));
  const qs = search.toString();
  return apiGet(`/organizations/${organizationId}/refund-requests${qs ? `?${qs}` : ''}`);
}

export function approveRefundRequest(
  refundRequestId: number,
  payload?: { approved_amount_cents?: number; review_notes?: string },
): Promise<RefundTransaction> {
  return apiPost(`/refund-requests/${refundRequestId}/approve`, payload ?? {});
}

export function denyRefundRequest(
  refundRequestId: number,
  payload: { review_notes: string },
): Promise<void> {
  return apiPost(`/refund-requests/${refundRequestId}/deny`, payload);
}

export function issueCreditForRefundRequest(
  refundRequestId: number,
  payload: { amount_cents: number; expiry_days?: number },
): Promise<{ id: number; amount_cents: number; currency: string; expires_at: string }> {
  return apiPost(`/refund-requests/${refundRequestId}/issue-credit`, payload);
}
