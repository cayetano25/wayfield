import { apiGet } from './client';
import type { OrderHistoryResponse, OrderHistoryDetail } from '@/lib/types/orders';

export function getOrderHistory(params?: { year?: number; page?: number }): Promise<OrderHistoryResponse> {
  const qs = new URLSearchParams();
  if (params?.year) qs.set('year', String(params.year));
  if (params?.page && params.page > 1) qs.set('page', String(params.page));
  const query = qs.toString();
  return apiGet<OrderHistoryResponse>(`/me/orders${query ? `?${query}` : ''}`);
}

export function getOrderDetail(orderNumber: string): Promise<OrderHistoryDetail> {
  return apiGet<{ data: OrderHistoryDetail }>(`/me/orders/${orderNumber}`).then((r) => r.data);
}
