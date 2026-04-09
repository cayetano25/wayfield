import { apiGet, apiPost } from './client';

export async function createWorkshop(orgId: number, data: object) {
  return apiPost(`/organizations/${orgId}/workshops`, data);
}

export async function getWorkshops(orgId: number) {
  return apiGet(`/organizations/${orgId}/workshops`);
}

export async function getWorkshop(workshopId: number) {
  return apiGet(`/workshops/${workshopId}`);
}

export type { DashboardResponse as DashboardStats } from '@/lib/types/dashboard';
import type { DashboardResponse } from '@/lib/types/dashboard';

export async function getDashboardStats(orgId: number): Promise<DashboardResponse> {
  return apiGet(`/organizations/${orgId}/dashboard`);
}

export async function getWorkshopParticipants(workshopId: number) {
  return apiGet(`/workshops/${workshopId}/participants`);
}
