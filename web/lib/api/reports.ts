import { apiGet } from './client';

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

export interface AttendanceReportWorkshop {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  participant_count: number;
  session_count: number;
  avg_attendance_rate: number;
}

export interface AttendanceReport {
  summary: {
    total_participants: number;
    avg_attendance_rate: number;
    total_sessions: number;
    workshops_run: number;
  };
  workshops: AttendanceReportWorkshop[];
}

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  return apiGet<Entitlements>(`/organizations/${orgId}/entitlements`);
}

export async function getAttendanceReport(
  orgId: number,
  params: { start_date: string; end_date: string },
): Promise<AttendanceReport> {
  const query = new URLSearchParams(params).toString();
  return apiGet<AttendanceReport>(
    `/organizations/${orgId}/reports/attendance?${query}`,
  );
}
