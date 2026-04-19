/* --- Leader dashboard types ------------------------------------------- */

export interface LeaderMessagingWindow {
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface LeaderSessionLocation {
  id: number;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_or_region: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LeaderDashboardSession {
  session_id: number;
  workshop_id?: number;
  workshop_title: string;
  workshop_timezone?: string;
  session_title: string;
  description?: string | null;
  start_at: string | null;
  end_at: string | null;
  location?: LeaderSessionLocation | null;
  location_display: string | null;
  workshop_default_location_id?: number | null;
  checked_in_count: number;
  enrolled_count: number;
  capacity: number | null;
  is_live: boolean;
  messaging_window: LeaderMessagingWindow;
  messaging_window_open?: boolean;
  messaging_window_start?: string | null;
  messaging_window_end?: string | null;
}

/* --- Roster participant ----------------------------------------------- */

export interface RosterParticipant {
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
  };
  registration_status: string;
  attendance: {
    status: 'not_checked_in' | 'checked_in' | 'no_show';
    check_in_method: string | null;
    checked_in_at: string | null;
  };
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

/* --- Session leader (roster) ------------------------------------------ */

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
