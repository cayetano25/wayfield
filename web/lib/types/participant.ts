export interface ParticipantNextSession {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  location_display: string | null;
  check_in_open: boolean;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
}

export interface ParticipantSession {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  location_display: string | null;
  attendance_status: 'checked_in' | 'not_checked_in' | null;
  is_next: boolean;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
}

export interface ParticipantLogistics {
  hotel_name: string | null;
  hotel_address_display: string | null;
  maps_url: string | null;
  workshop_image_url: string | null;
}

export interface ParticipantActiveWorkshop {
  workshop_id: number;
  title: string;
  description: string | null;
  header_image_url: string | null;
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
  sessions_count: number;
  checked_in_count: number;
  total_sessions: number;
}

export interface ParticipantDashboard {
  active_workshop: ParticipantActiveWorkshop | null;
  other_workshops: ParticipantOtherWorkshop[];
}
