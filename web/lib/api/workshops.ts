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

export interface DashboardStats {
  workshops: { total: number; published: number; draft: number };
  participants: { total: number };
  sessions_this_month: { total: number };
  attendance: { checked_in_today: number };
  plan: { plan_code: string; workshops_limit: number | null; participants_limit: number | null };
}

export async function getDashboardStats(orgId: number): Promise<DashboardStats> {
  return apiGet(`/organizations/${orgId}/dashboard`);
}

export async function getWorkshopParticipants(workshopId: number) {
  return apiGet(`/workshops/${workshopId}/participants`);
}
