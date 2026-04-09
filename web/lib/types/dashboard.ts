export interface AttendanceMetrics {
  attendance_rate: number | null;
  no_show_rate: number | null;
  total_checked_in: number;
  total_no_show: number;
  total_registered: number;
}

export interface CapacityMetrics {
  capacity_utilization: number | null;
  total_enrolled_in_capacity_sessions: number;
  total_capacity_slots: number;
}

export interface SessionBreakdown {
  session_id: number;
  session_title: string;
  workshop_title: string;
  enrolled_count: number;
  checked_in_count: number;
  no_show_count: number;
  session_attendance_rate: number | null;
  capacity: number | null;
}

export interface TrendPoint {
  week_start: string;
  registrations: number;
}

export interface StubMetric {
  stub: true;
  label: string;
  available_on: string;
  description: string;
}

export interface DashboardResponse {
  core: {
    workshops: { total: number; published: number; draft: number };
    participants: { total_registered: number };
    sessions_this_month: { total: number };
    attendance: { checked_in_today: number };
    plan: {
      plan_code: string;
      workshops_limit: number | null;
      participants_limit: number | null;
    };
  };
  analytics: {
    attendance_metrics: AttendanceMetrics | null;
    capacity_metrics: CapacityMetrics | null;
    session_breakdown: SessionBreakdown[] | null;
    registration_trend: TrendPoint[] | null;
  };
  stubs: Record<string, StubMetric>;
}
