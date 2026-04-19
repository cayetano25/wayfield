'use client';

import { useState } from 'react';
import { Hotel } from 'lucide-react';
import { AddressForm } from '@/components/ui/AddressForm';
import type { AddressFormData } from '@/lib/types/address';
import type { SessionLocationFormData, SessionLocationType } from '@/lib/types/session-location';

/* --- Coordinate validation -------------------------------------------- */

function isValidLatitude(val: string): boolean {
  const n = parseFloat(val);
  return !isNaN(n) && n >= -90 && n <= 90;
}

function isValidLongitude(val: string): boolean {
  const n = parseFloat(val);
  return !isNaN(n) && n >= -180 && n <= 180;
}

/* --- Exported validation helper --------------------------------------- */

export function isSessionLocationValid(data: SessionLocationFormData): boolean {
  if (data.location_type === null) return true;
  if (data.location_type === 'hotel') return true;
  if (data.location_type === 'address') {
    return !!(data.address?.country_code && data.address?.address_line_1);
  }
  if (data.location_type === 'coordinates') {
    return isValidLatitude(data.latitude) && isValidLongitude(data.longitude);
  }
  return true;
}

/* --- Notes placeholders ----------------------------------------------- */

const NOTE_PLACEHOLDERS: Record<NonNullable<SessionLocationType>, string> = {
  hotel:       'e.g. Conference room B, Ballroom level',
  address:     'e.g. Behind the post office, Enter from the east side',
  coordinates: 'e.g. At the rear of the parking lot, Trail starts here',
};

/* --- Props ------------------------------------------------------------ */

interface SessionLocationPickerProps {
  value: SessionLocationFormData;
  onChange: (data: SessionLocationFormData) => void;
  workshopTimezone?: string;
  hasHotel: boolean;
  hotelName?: string;
  disabled?: boolean;
}

/* --- Component -------------------------------------------------------- */

export function SessionLocationPicker({
  value,
  onChange,
  workshopTimezone,
  hasHotel,
  hotelName,
  disabled = false,
}: SessionLocationPickerProps) {
  const [latError, setLatError] = useState('');
  const [lngError, setLngError] = useState('');

  function set(patch: Partial<SessionLocationFormData>) {
    onChange({ ...value, ...patch });
  }

  function selectType(type: SessionLocationType) {
    onChange({
      ...value,
      location_type:  type,
      // clear coord errors on type switch
    });
    setLatError('');
    setLngError('');
  }

  function clearLocation() {
    onChange({
      location_type:  null,
      location_notes: '',
      latitude:       '',
      longitude:      '',
      location_name:  '',
      address:        null,
    });
    setLatError('');
    setLngError('');
  }

  const btnBase =
    'flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0FA3B1]/40';
  const btnActive  = 'bg-[#0FA3B1] text-white';
  const btnDefault = 'bg-[#F5F5F5] text-[#2E2E2E] hover:bg-[#E8E8E8]';
  const btnDisabled = 'bg-[#F5F5F5] text-[#C0C0C0] cursor-not-allowed opacity-60';

  /* -- map link for coordinates -- */
  const lat = parseFloat(value.latitude);
  const lng = parseFloat(value.longitude);
  const coordsValid =
    !isNaN(lat) && !isNaN(lng) &&
    value.latitude.trim() !== '' && value.longitude.trim() !== '';
  const mapsHref = coordsValid
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div>
        <label className="block text-sm font-semibold text-[#2E2E2E]">
          Session Location
        </label>
        <p className="mt-0.5 text-xs text-[#6B7280]">
          Where will this session take place?
        </p>
      </div>

      {/* Segmented control + clear link */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Hotel button */}
        <div className="relative group">
          <button
            type="button"
            disabled={!hasHotel || disabled}
            onClick={() => hasHotel && selectType('hotel')}
            className={`${btnBase} ${
              !hasHotel
                ? btnDisabled
                : value.location_type === 'hotel'
                  ? btnActive
                  : btnDefault
            }`}
            aria-pressed={value.location_type === 'hotel'}
          >
            <Hotel className="w-4 h-4 shrink-0" />
            {hasHotel ? (hotelName ?? 'Workshop Hotel') : 'Hotel'}
          </button>
          {!hasHotel && (
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-52 rounded-lg bg-[#2E2E2E] text-white text-xs px-2.5 py-1.5 leading-relaxed
                opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              Add hotel info to workshop logistics first
            </div>
          )}
        </div>

        {/* Address button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => selectType('address')}
          className={`${btnBase} ${value.location_type === 'address' ? btnActive : btnDefault}`}
          aria-pressed={value.location_type === 'address'}
        >
          📍 Address
        </button>

        {/* Coordinates button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => selectType('coordinates')}
          className={`${btnBase} ${value.location_type === 'coordinates' ? btnActive : btnDefault}`}
          aria-pressed={value.location_type === 'coordinates'}
        >
          🗺 Coordinates
        </button>

        {/* Clear link */}
        {value.location_type !== null && (
          <button
            type="button"
            onClick={clearLocation}
            disabled={disabled}
            className="ml-auto text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors underline-offset-2 hover:underline"
          >
            Clear location
          </button>
        )}
      </div>

      {/* Form panel */}
      {value.location_type !== null && (
        <div
          className="rounded-lg border border-[#E5E7EB] bg-white p-4 space-y-4"
          style={{ animation: 'fadeIn 150ms ease-out' }}
        >
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* -- Hotel panel -- */}
          {value.location_type === 'hotel' && (
            <div
              className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
              style={{ background: '#E8F7F9', borderLeft: '3px solid #0FA3B1' }}
            >
              <Hotel className="w-4 h-4 text-[#0FA3B1] shrink-0 mt-0.5" />
              <p className="text-sm text-[#0FA3B1] font-medium leading-snug">
                {hotelName ?? 'Workshop Hotel'} — inherited from workshop logistics
              </p>
            </div>
          )}

          {/* -- Address panel -- */}
          {value.location_type === 'address' && (
            <AddressForm
              value={value.address}
              onChange={(addr: AddressFormData) => set({ address: addr })}
              workshopTimezone={workshopTimezone}
              label="Location Address"
              required={true}
              disabled={disabled}
            />
          )}

          {/* -- Coordinates panel -- */}
          {value.location_type === 'coordinates' && (
            <div className="space-y-3">
              {/* Lat / Lng row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Latitude */}
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#2E2E2E]">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 43.574035"
                    value={value.latitude}
                    disabled={disabled}
                    onChange={(e) => {
                      set({ latitude: e.target.value });
                      if (latError) setLatError('');
                    }}
                    onBlur={() => {
                      if (value.latitude && !isValidLatitude(value.latitude)) {
                        setLatError('Must be a number between -90 and 90');
                      } else {
                        setLatError('');
                      }
                    }}
                    className={`w-full h-9 px-3 text-sm text-[#2E2E2E] bg-white border rounded-[6px] outline-none transition-colors
                      placeholder:text-[#C0C0C0]
                      focus:ring-2 focus:ring-[#0FA3B1]/20 focus:border-[#0FA3B1]
                      disabled:opacity-60
                      ${latError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-[#D1D5DB]'}`}
                  />
                  {latError && (
                    <p className="text-xs text-red-500">{latError}</p>
                  )}
                </div>

                {/* Longitude */}
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#2E2E2E]">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. -103.487691"
                    value={value.longitude}
                    disabled={disabled}
                    onChange={(e) => {
                      set({ longitude: e.target.value });
                      if (lngError) setLngError('');
                    }}
                    onBlur={() => {
                      if (value.longitude && !isValidLongitude(value.longitude)) {
                        setLngError('Must be a number between -180 and 180');
                      } else {
                        setLngError('');
                      }
                    }}
                    className={`w-full h-9 px-3 text-sm text-[#2E2E2E] bg-white border rounded-[6px] outline-none transition-colors
                      placeholder:text-[#C0C0C0]
                      focus:ring-2 focus:ring-[#0FA3B1]/20 focus:border-[#0FA3B1]
                      disabled:opacity-60
                      ${lngError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-[#D1D5DB]'}`}
                  />
                  {lngError && (
                    <p className="text-xs text-red-500">{lngError}</p>
                  )}
                </div>
              </div>

              {/* Location name */}
              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-[#2E2E2E]">
                  Location Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Black Hills Sunrise Ridge (optional)"
                  value={value.location_name}
                  disabled={disabled}
                  onChange={(e) => set({ location_name: e.target.value })}
                  className="w-full h-9 px-3 text-sm text-[#2E2E2E] bg-white border border-[#D1D5DB] rounded-[6px] outline-none transition-colors
                    placeholder:text-[#C0C0C0]
                    focus:ring-2 focus:ring-[#0FA3B1]/20 focus:border-[#0FA3B1]
                    disabled:opacity-60"
                />
                <p className="text-[11px] italic text-[#9CA3AF]">
                  Enter coordinates from your GPS, Google Maps, or AllTrails.
                  A place name will be suggested automatically after saving.
                </p>
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-[#0FA3B1] hover:underline mt-0.5"
                  >
                    View on Google Maps ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* -- Notes (all types) -- */}
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[#2E2E2E]">
              Location Notes
            </label>
            <textarea
              rows={3}
              maxLength={500}
              placeholder={NOTE_PLACEHOLDERS[value.location_type]}
              value={value.location_notes}
              disabled={disabled}
              onChange={(e) => set({ location_notes: e.target.value })}
              className="w-full px-3 py-2 text-sm text-[#2E2E2E] bg-white border border-[#D1D5DB] rounded-[6px] outline-none resize-none transition-colors
                placeholder:text-[#C0C0C0]
                focus:ring-2 focus:ring-[#0FA3B1]/20 focus:border-[#0FA3B1]
                disabled:opacity-60"
            />
            <p className="text-[11px] text-[#9CA3AF]">
              Optional — helps participants find the exact spot
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
