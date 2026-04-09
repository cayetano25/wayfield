import type { SessionLocationFormData } from '@/lib/types/session-location';

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
