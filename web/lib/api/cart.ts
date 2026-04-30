import { apiDelete, apiGet, apiPost } from './client';

export interface CartCouponData {
  code: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free';
  discount_pct?: number;
  discount_amount_formatted: string;
  discount_cents: number;
  discounted_total_cents: number;
  message: string;
}

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
  is_tier_price: boolean;
  applied_tier_label: string | null;
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
  organization_name?: string | null;
  organization_slug?: string | null;
  status: 'active' | 'checked_out' | 'abandoned' | 'expired';
  subtotal_cents: number;
  discount_cents: number;
  discounted_total_cents: number;
  currency: string;
  expires_at: string;
  items: CartItem[];
  coupon: CartCouponData | null;
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
  is_tier_price: boolean;
  applied_tier_label: string | null;
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
  balance_amount_cents: number | null;
  balance_paid_at: string | null;
  completed_at: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface BalancePaymentIntent {
  client_secret: string;
  stripe_publishable_key: string;
  amount_cents: number;
  deposit_amount_cents: number;
  balance_due_date: string | null;
  workshop_title: string | null;
  order_number: string;
  days_until_expiry: number;
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

interface ApplyCouponApiResponse {
  data: {
    coupon_code: string;
    discount_type: string;
    discount_pct?: number;
    discount_amount: string;
    discounted_total: string;
    message: string;
  };
}

export async function applyCoupon(
  organizationId: number,
  code: string,
): Promise<CartCouponData> {
  const res = await apiPost<ApplyCouponApiResponse>(`/cart/${organizationId}/coupon`, { code });
  const discountCents = Math.round(parseFloat(res.data.discount_amount) * 100);
  const discountedTotalCents = Math.round(parseFloat(res.data.discounted_total) * 100);
  return {
    code: res.data.coupon_code,
    discount_type: res.data.discount_type as CartCouponData['discount_type'],
    discount_pct: res.data.discount_pct,
    discount_amount_formatted: '$' + res.data.discount_amount,
    discount_cents: discountCents,
    discounted_total_cents: discountedTotalCents,
    message: res.data.message,
  };
}

export function removeCoupon(organizationId: number): Promise<void> {
  return apiDelete<unknown>(`/cart/${organizationId}/coupon`).then(() => undefined);
}

export function getOrder(orderNumber: string): Promise<OrderSummary> {
  return apiGet(`/orders/${orderNumber}`);
}

export function getBalancePaymentIntent(orderNumber: string): Promise<BalancePaymentIntent> {
  return apiGet(`/orders/${orderNumber}/balance-payment-intent`);
}
