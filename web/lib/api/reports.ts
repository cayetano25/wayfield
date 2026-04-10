import { apiGet } from './client';

/* ─── Entitlements ────────────────────────────────────────────────────── */

export interface Entitlements {
  plan: string;
  subscription_status: string;
  limits: {
    max_active_workshops: number | null;
    max_participants_per_workshop: number | null;
    max_managers: number | null;
  };
  features: {
    analytics: boolean;
    reporting: boolean;
    automation: boolean;
    advanced_notifications: boolean;
    waitlists: boolean;
    branded_pages: boolean;
    leader_messaging: boolean;
    api_access: boolean;
    webhooks: boolean;
    segmentation: boolean;
  };
  usage: {
    active_workshop_count: number;
    active_manager_count: number;
    active_leader_count: number;
  };
}

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  return apiGet<Entitlements>(`/organizations/${orgId}/entitlements`);
}

/* ─── Attendance report ───────────────────────────────────────────────── */

export interface AttendanceReportWorkshop {
  id: number;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  registered: number;
  checked_in: number;
  no_show: number;
  rate: number; // 0-100
}

export interface AttendanceReportSession {
  id: number;
  title: string;
  start_at: string;
  enrolled: number;
  checked_in: number;
  no_show: number;
  rate: number; // 0-100
}

export interface AttendanceReport {
  summary: {
    total_registered: number;
    total_checked_in: number;
    attendance_rate: number; // 0-100
    no_show_rate: number;    // 0-100
  };
  workshops: AttendanceReportWorkshop[];
  sessions?: AttendanceReportSession[];
}

export async function getAttendanceReport(
  orgId: number,
  params: { start_date: string; end_date: string; workshop_id?: number },
): Promise<AttendanceReport> {
  const qs = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
  });
  if (params.workshop_id) qs.set('workshop_id', String(params.workshop_id));
  return apiGet<AttendanceReport>(`/organizations/${orgId}/reports/attendance?${qs}`);
}

/* ─── Workshops report ────────────────────────────────────────────────── */

export interface WorkshopsReportItem {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  sessions_count: number;
  leaders_count: number;
  participants_count: number;
  capacity: number | null;
  attendance_rate: number; // 0-100
}

export interface WorkshopsReport {
  summary: {
    total: number;
    published: number;
    draft: number;
    total_participants: number;
  };
  workshops: WorkshopsReportItem[];
}

export async function getWorkshopsReport(orgId: number): Promise<WorkshopsReport> {
  return apiGet<WorkshopsReport>(`/organizations/${orgId}/reports/workshops`);
}

/* ─── Participants report ─────────────────────────────────────────────── */

export interface ParticipantReportItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  registered_at: string;
  sessions_selected: number;
  sessions_attended: number;
  last_check_in_at: string | null;
}

export interface ParticipantsReport {
  participants: ParticipantReportItem[];
  total: number;
}

export async function getParticipantsReport(
  orgId: number,
  workshopId: number,
): Promise<ParticipantsReport> {
  return apiGet<ParticipantsReport>(
    `/organizations/${orgId}/reports/participants?workshop_id=${workshopId}`,
  );
}

/* ─── Registration trend ──────────────────────────────────────────────── */

export interface TrendPoint {
  week_start: string;
  registrations: number;
}

export interface RegistrationTrendReport {
  data: TrendPoint[];
}

export async function getRegistrationTrend(
  orgId: number,
  params: { start_date: string; end_date: string },
): Promise<RegistrationTrendReport> {
  const qs = new URLSearchParams(params).toString();
  return apiGet<RegistrationTrendReport>(
    `/organizations/${orgId}/reports/registration-trend?${qs}`,
  );
}

/* ─── Export ──────────────────────────────────────────────────────────── */

export async function exportReport(
  orgId: number,
  params: { type: string; format: string; workshop_id?: number },
): Promise<Blob> {
  const qs = new URLSearchParams({ type: params.type, format: params.format });
  if (params.workshop_id) qs.set('workshop_id', String(params.workshop_id));
  const token = (await import('@/lib/auth/session')).getToken();
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  const res = await fetch(`${BASE_URL}/organizations/${orgId}/reports/export?${qs}`, {
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}
