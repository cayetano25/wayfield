export type SessionState = 'available' | 'selected' | 'conflicted' | 'full';

export interface SessionLeaderSummary {
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
}

export interface SelectableSession {
  session_id: number;
  title: string;
  description: string | null;
  start_at: string;              // ISO 8601 UTC
  end_at: string;                // ISO 8601 UTC
  start_display: string;         // "10:00 AM" in workshop timezone
  end_display: string;           // "12:00 PM"
  duration_minutes: number;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  location_display: string | null;
  leaders: SessionLeaderSummary[];
  capacity: number | null;
  enrolled_count: number;
  spots_remaining: number | null;
  state: SessionState;
  conflict_with: { session_id: number; title: string } | null;
}

export interface TimeSlot {
  slot_time: string;       // "10:00 AM"
  is_parallel: boolean;   // true if multiple sessions at same time
  sessions: SelectableSession[];
}

export interface SelectionDay {
  date: string;            // "2025-06-14"
  day_label: string;       // "Saturday"
  day_short: string;       // "SAT"
  date_formatted: string;  // "June 14"
  time_slots: TimeSlot[];
}

export interface SelectionOptionsResponse {
  workshop: {
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    timezone: string;
    workshop_type: 'session_based' | 'event_based';
  };
  selection_summary: {
    total_selectable: number;
    total_selected: number;
    has_conflicts: boolean;
  };
  selected_session_ids: number[];
  days: SelectionDay[];
}

export interface MyScheduleSession {
  session_id: number;
  title: string;
  start_at: string;
  end_at: string;
  start_display: string;
  end_display: string;
  day_label: string;
  day_short: string;
  location_display: string | null;
  leaders: SessionLeaderSummary[];
}

export interface ConflictError {
  error: 'time_conflict';
  conflict_with: {
    session_id: number;
    title: string;
    start_display: string;
    end_display: string;
  };
}

export interface FullError {
  error: 'session_full';
  session_title: string;
}
