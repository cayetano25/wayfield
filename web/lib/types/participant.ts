import type { SessionLocationResponse } from './session-location';

export type ParticipantSessionLocation = SessionLocationResponse;

export interface ParticipantNextSession {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  location_display: string | null;
  check_in_open: boolean;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
}

export interface ParticipantSessionLeader {
  id: number;
  first_name: string;
  last_name: string;
  city: string | null;
  state_or_region: string | null;
  bio: string | null;
  profile_image_url: string | null;
}

export interface ParticipantSession {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location_display: string | null;
  location: ParticipantSessionLocation | null;
  leaders: ParticipantSessionLeader[];
  attendance_status: 'checked_in' | 'not_checked_in' | null;
  is_next: boolean;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
}

export interface ParticipantLogistics {
  hotel_name: string | null;
  hotel_address_display: string | null;
  hotel_phone: string | null;
  hotel_notes: string | null;
  parking_details: string | null;
  meeting_room_details: string | null;
  meetup_instructions: string | null;
  location_name: string | null;
  venue_address_display: string | null;
  location_lat: number | null;
  location_lng: number | null;
  workshop_image_url: string | null;
}

export interface ParticipantActiveWorkshop {
  workshop_id: number;
  title: string;
  description: string | null;
  header_image_url: string | null;
  workshop_type: 'session_based' | 'event_based';
  public_slug: string | null;
  public_page_enabled: boolean;
  total_selectable: number;
  total_selected: number;
  start_date: string | null;
  end_date: string | null;
  default_location_id: number | null;
  next_session: ParticipantNextSession | null;
  sessions: ParticipantSession[];
  logistics: ParticipantLogistics | null;
}

export interface ParticipantOtherWorkshop {
  workshop_id: number;
  title: string;
  series?: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'completed';
  workshop_type: 'session_based' | 'event_based';
  public_slug: string | null;
  public_page_enabled: boolean;
  sessions_count: number;
  checked_in_count: number;
  total_sessions: number;
  /** Payment status label from Order.getPaymentStatusLabel() — absent when workshop is free */
  payment_status?: 'Free' | 'Deposit Paid' | 'Fully Paid' | 'Balance Due' | 'Payment Pending' | null;
  balance_due_date?: string | null;
  order_number?: string | null;
  is_tier_price?: boolean;
  applied_tier_label?: string | null;
}

export interface ParticipantDashboard {
  active_workshop: ParticipantActiveWorkshop | null;
  other_workshops: ParticipantOtherWorkshop[];
}
