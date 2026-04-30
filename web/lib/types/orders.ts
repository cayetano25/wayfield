export interface OrderHistoryOrganization {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface OrderHistoryItem {
  id: number;
  item_type: string;
  item_type_label: string;
  workshop_id: number | null;
  workshop_title: string | null;
  workshop_dates: string | null;
  session_title: string | null;
  line_total: string;
  is_deposit: boolean;
  applied_tier_label: string | null;
  refund_status: string;
  refunded_amount: string | null;
}

export interface OrderHistoryEntry {
  id: number;
  order_number: string;
  status: string;
  status_label: string;
  total: string;
  total_cents: number;
  currency: string;
  payment_method: string;
  is_deposit_order: boolean;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  balance_due_date: string | null;
  completed_at: string | null;
  organization: OrderHistoryOrganization | null;
  items: OrderHistoryItem[];
}

export interface OrderHistoryMeta {
  current_page: number;
  last_page: number;
  total: number;
  total_spent: string;
}

export interface OrderHistoryResponse {
  data: OrderHistoryEntry[];
  meta: OrderHistoryMeta;
}

export interface OrderHistoryRefundRequest {
  id: number;
  status: string;
  requested_amount: string;
  approved_amount: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface OrderHistoryCoupon {
  code: string;
  discount_type: string;
  discount_display: string;
}

export interface OrderHistoryDetail extends OrderHistoryEntry {
  subtotal_cents: number | null;
  balance_amount_cents: number | null;
  wayfield_fee_cents: number | null;
  stripe_fee_cents: number | null;
  discount_cents: number | null;
  coupon: OrderHistoryCoupon | null;
  refund_requests: OrderHistoryRefundRequest[];
  can_request_refund: boolean;
  receipt_url: string;
}
