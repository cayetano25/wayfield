/* ─── Leader dashboard types ─────────────────────────────────────────── */

export interface LeaderMessagingWindow {
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface LeaderDashboardSession {
  session_id: number;
  workshop_id: number;
  workshop_title: string;
  title: string;
  start_at: string;
  end_at: string;
  location_display: string | null;
  checked_in_count: number;
  enrolled_count: number;
  capacity: number | null;
  is_live: boolean;
  messaging_window: LeaderMessagingWindow;
}

export interface LeaderPendingInvitation {
  invitation_id: number;
  organization_name: string;
  workshop_title: string;
  workshop_dates: string;
  token: string;
}

export interface LeaderDashboard {
  pending_invitations: LeaderPendingInvitation[];
  today: { sessions: LeaderDashboardSession[] };
  this_week: LeaderDashboardSession[];
  upcoming: LeaderDashboardSession[];
}

/* ─── Session leader (roster) ────────────────────────────────────────── */

export interface SessionLeader {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  city: string | null;
  state_or_region: string | null;
  role_label: string | null;
  phone_number: string | null;
  phone_visible: boolean;
}

export function leaderFullName(leader: SessionLeader): string {
  return `${leader.first_name} ${leader.last_name}`.trim();
}

export function leaderLocation(leader: SessionLeader): string | null {
  const parts = [leader.city, leader.state_or_region].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
