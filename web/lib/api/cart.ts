import { apiDelete, apiGet, apiPost } from './client';

export interface CartItem {
  id: number;
  item_type: 'workshop_registration' | 'addon_session' | 'waitlist_upgrade';
  workshop_id: number | null;
  session_id: number | null;
  workshop_title: string | null;
  session_title: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  is_deposit: boolean;
  deposit_amount_cents: number | null;
  balance_amount_cents: number | null;
  balance_due_date: string | null;
  currency: string;
}

export interface FeeBreakdown {
  wayfield_fee_cents: number;
  stripe_fee_cents: number;
  total_fee_cents: number;
  organizer_payout_cents: number;
  take_rate_pct: number;
}

export interface Cart {
  id: number;
  organization_id: number;
  status: 'active' | 'checked_out' | 'abandoned' | 'expired';
  subtotal_cents: number;
  currency: string;
  expires_at: string;
  items: CartItem[];
  fee_breakdown: FeeBreakdown | null;
}

export interface CheckoutFreeResult {
  order_number: string;
  status: 'completed';
  requires_payment: false;
  order: OrderSummary;
}

export interface CheckoutPaidResult {
  order_number: string;
  status: 'pending';
  requires_payment: true;
  client_secret: string;
  stripe_publishable_key: string;
}

export type CheckoutResult = CheckoutFreeResult | CheckoutPaidResult;

export interface OrderItem {
  id: number;
  item_type: string;
  workshop_id: number | null;
  session_id: number | null;
  workshop_title: string | null;
  session_title: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  is_deposit: boolean;
  balance_due_date: string | null;
  refunded_amount_cents: number;
  refund_status: string;
  currency: string;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  organization_id: number;
  status: string;
  payment_status_label: string;
  payment_method: string;
  subtotal_cents: number;
  wayfield_fee_cents: number;
  stripe_fee_cents: number;
  total_cents: number;
  organizer_payout_cents: number;
  currency: string;
  is_deposit_order: boolean;
  deposit_paid_at: string | null;
  balance_due_date: string | null;
  balance_paid_at: string | null;
  completed_at: string | null;
  created_at: string;
  items: OrderItem[];
}

export function getCart(organizationId: number): Promise<Cart> {
  return apiGet(`/cart/${organizationId}`);
}

export function addCartItem(
  organizationId: number,
  payload: { item_type: string; workshop_id?: number; session_id?: number },
): Promise<Cart> {
  return apiPost(`/cart/${organizationId}/items`, payload);
}

export function removeCartItem(organizationId: number, cartItemId: number): Promise<Cart> {
  return apiDelete(`/cart/${organizationId}/items/${cartItemId}`);
}

export function checkoutCart(organizationId: number): Promise<CheckoutResult> {
  return apiPost(`/cart/${organizationId}/checkout`);
}

export function getOrder(orderNumber: string): Promise<OrderSummary> {
  return apiGet(`/orders/${orderNumber}`);
}
