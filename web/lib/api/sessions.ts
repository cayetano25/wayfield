import { apiDelete, apiGet } from '@/lib/api/client';
import type { SessionLocationFormData } from '@/lib/types/session-location';
import type {
  ConflictError,
  FullError,
  MyScheduleSession,
  SelectionOptionsResponse,
} from '@/lib/types/session-selection';

// --- Custom error classes ----------------------------------------------------

export class TimeConflictError extends Error {
  constructor(public data: ConflictError) {
    super('Time conflict');
    this.name = 'TimeConflictError';
  }
}

export class SessionFullError extends Error {
  constructor(public data: FullError) {
    super('Session full');
    this.name = 'SessionFullError';
  }
}

// --- Participant session-selection API ---------------------------------------

export async function getSelectionOptions(
  workshopId: number,
): Promise<SelectionOptionsResponse> {
  return apiGet<SelectionOptionsResponse>(
    `/workshops/${workshopId}/selection-options`,
  );
}

export async function selectSession(
  workshopId: number,
  sessionId: number,
): Promise<{
  message: string;
  selection: { session_id: number; title: string };
  updated_summary: { total_selected: number };
}> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  const { getToken } = await import('@/lib/auth/session');
  const token = getToken();

  const response = await fetch(`${BASE_URL}/workshops/${workshopId}/selections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.error === 'time_conflict') throw new TimeConflictError(error as ConflictError);
    if (error.error === 'session_full') throw new SessionFullError(error as FullError);
    throw new Error(error.message ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function deselectSession(
  workshopId: number,
  sessionId: number,
): Promise<{ message: string; updated_summary: { total_selected: number } }> {
  return apiDelete<{ message: string; updated_summary: { total_selected: number } }>(
    `/workshops/${workshopId}/selections/${sessionId}`,
  );
}

export async function getMySelections(
  workshopId: number,
): Promise<{ selected_sessions: MyScheduleSession[]; total_selected: number }> {
  return apiGet<{ selected_sessions: MyScheduleSession[]; total_selected: number }>(
    `/workshops/${workshopId}/my-selections`,
  );
}

export function buildLocationPayload(
  data: SessionLocationFormData,
): Record<string, unknown> {
  if (!data.location_type) {
    return { location_type: null };
  }

  if (data.location_type === 'hotel') {
    return {
      location_type:  'hotel',
      location_notes: data.location_notes || null,
    };
  }

  if (data.location_type === 'coordinates') {
    return {
      location_type:  'coordinates',
      location_notes: data.location_notes || null,
      latitude:       parseFloat(data.latitude),
      longitude:      parseFloat(data.longitude),
      location_name:  data.location_name || null,
    };
  }

  if (data.location_type === 'address') {
    return {
      location_type:  'address',
      location_notes: data.location_notes || null,
      address:        data.address,
      location_name:  data.location_name || null,
    };
  }

  return {};
}
