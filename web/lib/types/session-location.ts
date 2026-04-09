import type { AddressFormData, AddressApiResponse } from './address';

export type SessionLocationType = 'hotel' | 'address' | 'coordinates' | null;

export interface SessionLocationFormData {
  location_type: SessionLocationType;
  location_notes: string;
  // coordinates mode
  latitude: string;   // string for controlled input, parse to float on submit
  longitude: string;
  location_name: string;
  // address mode
  address: AddressFormData | null;
}

export interface SessionLocationResponse {
  type: SessionLocationType;
  notes: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  address: AddressApiResponse | null;
  maps_url: string | null;
}

export const EMPTY_SESSION_LOCATION: SessionLocationFormData = {
  location_type:  null,
  location_notes: '',
  latitude:       '',
  longitude:      '',
  location_name:  '',
  address:        null,
};
