import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './client';

export interface PriceTier {
  id: number;
  label: string;
  price_cents: number;
  price_formatted: string;
  valid_from: string | null;
  valid_until: string | null;
  capacity_limit: number | null;
  registrations_at_tier: number;
  sort_order: number;
  is_active: boolean;
  is_currently_active: boolean;
  remaining_capacity: number | null;
}

export interface CreateTierPayload {
  label: string;
  price_cents: number;
  valid_from?: string | null;
  valid_until?: string | null;
  capacity_limit?: number | null;
}

export type UpdateTierPayload = Partial<CreateTierPayload>;

export function listPriceTiers(workshopId: number): Promise<{ data: PriceTier[] }> {
  return apiGet<{ data: PriceTier[] }>(`/workshops/${workshopId}/price-tiers`);
}

export function createPriceTier(
  workshopId: number,
  data: CreateTierPayload,
): Promise<{ data: PriceTier }> {
  return apiPost<{ data: PriceTier }>(`/workshops/${workshopId}/price-tiers`, data);
}

export function updatePriceTier(
  workshopId: number,
  tierId: number,
  data: UpdateTierPayload,
): Promise<{ data: PriceTier }> {
  return apiPatch<{ data: PriceTier }>(
    `/workshops/${workshopId}/price-tiers/${tierId}`,
    data,
  );
}

export function deletePriceTier(workshopId: number, tierId: number): Promise<void> {
  return apiDelete<void>(`/workshops/${workshopId}/price-tiers/${tierId}`);
}

export function reorderPriceTiers(
  workshopId: number,
  tiers: { id: number; sort_order: number }[],
): Promise<void> {
  return apiPut<void>(`/workshops/${workshopId}/price-tiers/order`, { tiers });
}
