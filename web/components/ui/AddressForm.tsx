'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import type { AddressFormData, CountryConfig } from '@/lib/types/address';
import { useCountries } from '@/lib/hooks/useCountries';
import {
  getCountryFlag,
  buildFormattedAddressPreview,
  validatePostalCode,
} from '@/lib/utils/addresses';

interface AddressFormProps {
  value: AddressFormData | null;
  onChange: (data: AddressFormData) => void;
  defaultCountryCode?: string;
  workshopTimezone?: string;
  label?: string;
  showValidationStatus?: boolean;
  required?: boolean;
  privacyNote?: string;
  disabled?: boolean;
  className?: string;
}

const EMPTY_ADDRESS: AddressFormData = {
  country_code: 'US',
  address_line_1: '',
  address_line_2: '',
  locality: '',
  administrative_area: '',
  postal_code: '',
};

function buildInitialData(
  value: AddressFormData | null,
  defaultCountryCode?: string,
): AddressFormData {
  return {
    ...EMPTY_ADDRESS,
    country_code: value?.country_code ?? defaultCountryCode ?? 'US',
    address_line_1: value?.address_line_1 ?? '',
    address_line_2: value?.address_line_2 ?? '',
    address_line_3: value?.address_line_3 ?? '',
    locality: value?.locality ?? '',
    administrative_area: value?.administrative_area ?? '',
    dependent_locality: value?.dependent_locality ?? '',
    postal_code: value?.postal_code ?? '',
    sorting_code: value?.sorting_code ?? '',
  };
}

const INPUT_CLASS =
  'w-full h-10 px-3 text-sm text-dark bg-white border rounded-lg outline-none transition-colors ' +
  'placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary ' +
  'disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed border-border-gray';

const INPUT_ERROR_CLASS =
  'w-full h-10 px-3 text-sm text-dark bg-white border rounded-lg outline-none transition-colors ' +
  'placeholder:text-light-gray focus:ring-2 focus:ring-danger/20 focus:border-danger ' +
  'disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed border-danger';

function FieldLabel({
  htmlFor,
  text,
  required,
}: {
  htmlFor: string;
  text: string;
  required: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-dark">
      {text}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  );
}

export function AddressForm({
  value,
  onChange,
  defaultCountryCode,
  workshopTimezone,
  label,
  privacyNote,
  disabled = false,
  className = '',
}: AddressFormProps) {
  const { countries, loading: countriesLoading, getCountryConfig, inferCountry } =
    useCountries();

  const [localData, setLocalData] = useState<AddressFormData>(() =>
    buildInitialData(value, defaultCountryCode),
  );
  const [countryConfig, setCountryConfig] = useState<CountryConfig | null>(null);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const [countryLoading, setCountryLoading] = useState(false);

  // Combobox state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxQuery, setComboboxQuery] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);
  const comboboxInputRef = useRef<HTMLInputElement>(null);

  // Refs to avoid stale closures
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isFirstRender = useRef(true);

  // Update country config whenever country_code or countries change
  useEffect(() => {
    const config = getCountryConfig(localData.country_code);
    setCountryConfig(config);
  }, [localData.country_code, countries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infer country from timezone (on mount + when timezone changes)
  const prevTimezone = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!workshopTimezone) return;
    if (workshopTimezone === prevTimezone.current) return;
    prevTimezone.current = workshopTimezone;

    setCountryLoading(true);
    inferCountry(workshopTimezone).then(({ country_code, config }) => {
      setLocalData((prev) => ({ ...prev, country_code }));
      if (config) setCountryConfig(config);
    }).finally(() => setCountryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopTimezone]);

  // Debounced onChange — skips first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onChangeRef.current(localData);
    }, 50);
    return () => clearTimeout(timer);
  }, [localData]);

  // Click-outside to close combobox
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
        setComboboxQuery('');
      }
    }
    if (comboboxOpen) {
      document.addEventListener('mousedown', handleMouseDown);
    }
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [comboboxOpen]);

  const handleFieldChange = useCallback(
    (field: keyof AddressFormData, val: string) => {
      setLocalData((prev) => ({ ...prev, [field]: val }));
      if (field === 'postal_code') setPostalCodeError(null);
    },
    [],
  );

  function handleCountrySelect(code: string) {
    setLocalData((prev) => ({ ...prev, country_code: code }));
    setPostalCodeError(null);
    setComboboxOpen(false);
    setComboboxQuery('');
  }

  function handlePostalBlur() {
    if (!countryConfig) return;
    const pc = localData.postal_code ?? '';
    if (!pc && !countryConfig.postal_code_required) {
      setPostalCodeError(null);
      return;
    }
    if (!validatePostalCode(pc, countryConfig)) {
      const countryName = countries.find((c) => c.code === localData.country_code)?.name ?? '';
      setPostalCodeError(`Invalid format for ${countryName} postal code`);
    } else {
      setPostalCodeError(null);
    }
  }

  const filteredCountries = comboboxQuery
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(comboboxQuery.toLowerCase()),
      )
    : countries;

  const selectedCountryName =
    countries.find((c) => c.code === localData.country_code)?.name ?? localData.country_code;

  const comboboxDisplayValue = comboboxOpen
    ? comboboxQuery
    : `${getCountryFlag(localData.country_code)} ${selectedCountryName}`;

  const preview = buildFormattedAddressPreview(localData);

  return (
    <div className={className}>
      {label && (
        <p className="text-sm font-semibold text-dark mb-3">{label}</p>
      )}

      <div className="space-y-4">
        {/* Country selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark">Country</label>
          <div ref={comboboxRef} className="relative">
            <input
              ref={comboboxInputRef}
              type="text"
              className={INPUT_CLASS + ' pr-9'}
              value={comboboxDisplayValue}
              placeholder={countriesLoading ? 'Loading countries…' : 'Select a country'}
              disabled={disabled || countriesLoading}
              onChange={(e) => {
                setComboboxQuery(e.target.value);
                if (!comboboxOpen) setComboboxOpen(true);
              }}
              onFocus={() => {
                setComboboxOpen(true);
                setComboboxQuery('');
              }}
              autoComplete="off"
            />
            <ChevronDown
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none transition-transform ${comboboxOpen ? 'rotate-180' : ''}`}
            />
            {comboboxOpen && filteredCountries.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border-gray rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCountrySelect(c.code);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 hover:bg-surface ${
                      c.code === localData.country_code ? 'bg-primary/5 text-primary font-medium' : 'text-dark'
                    }`}
                  >
                    <span className="text-base leading-none">{getCountryFlag(c.code)}</span>
                    {c.name}
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <p className="px-3 py-4 text-sm text-medium-gray text-center">
                    No countries found
                  </p>
                )}
              </div>
            )}
          </div>
          {countryLoading && (
            <p className="text-xs text-medium-gray">Detecting country…</p>
          )}
        </div>

        {/* Address Line 1 */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="addr-line1" text="Address Line 1" required={true} />
          <input
            id="addr-line1"
            type="text"
            className={INPUT_CLASS}
            value={localData.address_line_1}
            onChange={(e) => handleFieldChange('address_line_1', e.target.value)}
            placeholder="Street address"
            disabled={disabled}
          />
        </div>

        {/* Address Line 2 */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="addr-line2" text="Address Line 2" required={false} />
          <input
            id="addr-line2"
            type="text"
            className={INPUT_CLASS}
            value={localData.address_line_2 ?? ''}
            onChange={(e) => handleFieldChange('address_line_2', e.target.value)}
            placeholder="Apartment, suite, unit, etc. (optional)"
            disabled={disabled}
          />
        </div>

        {/* Address Line 3 — only for countries that use it */}
        {countryConfig?.address_line_3_used && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="addr-line3" text="Address Line 3" required={false} />
            <input
              id="addr-line3"
              type="text"
              className={INPUT_CLASS}
              value={localData.address_line_3 ?? ''}
              onChange={(e) => handleFieldChange('address_line_3', e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        {/* Dependent Locality */}
        {countryConfig?.dependent_locality_label && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="addr-dep-locality"
              text={countryConfig.dependent_locality_label}
              required={false}
            />
            <input
              id="addr-dep-locality"
              type="text"
              className={INPUT_CLASS}
              value={localData.dependent_locality ?? ''}
              onChange={(e) => handleFieldChange('dependent_locality', e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        {/* City / Locality + State / Admin Area row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Locality */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="addr-locality"
              text={countryConfig?.locality_label ?? 'City'}
              required={countryConfig?.locality_required ?? true}
            />
            <input
              id="addr-locality"
              type="text"
              className={INPUT_CLASS}
              value={localData.locality}
              onChange={(e) => handleFieldChange('locality', e.target.value)}
              disabled={disabled}
            />
          </div>

          {/* Administrative Area */}
          {countryConfig?.administrative_area_label && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor="addr-admin-area"
                text={countryConfig.administrative_area_label}
                required={countryConfig.administrative_area_required}
              />
              {countryConfig.administrative_area_options ? (
                <select
                  id="addr-admin-area"
                  className={INPUT_CLASS + ' appearance-none'}
                  value={localData.administrative_area ?? ''}
                  onChange={(e) =>
                    handleFieldChange('administrative_area', e.target.value)
                  }
                  disabled={disabled}
                >
                  <option value="">Select {countryConfig.administrative_area_label}…</option>
                  {Object.entries(countryConfig.administrative_area_options).map(
                    ([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <input
                  id="addr-admin-area"
                  type="text"
                  className={INPUT_CLASS}
                  value={localData.administrative_area ?? ''}
                  onChange={(e) =>
                    handleFieldChange('administrative_area', e.target.value)
                  }
                  disabled={disabled}
                />
              )}
            </div>
          )}
        </div>

        {/* Postal Code */}
        {countryConfig?.postal_code_label && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="addr-postal"
              text={countryConfig.postal_code_label}
              required={countryConfig.postal_code_required}
            />
            <input
              id="addr-postal"
              type="text"
              className={postalCodeError ? INPUT_ERROR_CLASS : INPUT_CLASS}
              value={localData.postal_code ?? ''}
              onChange={(e) => handleFieldChange('postal_code', e.target.value)}
              onBlur={handlePostalBlur}
              disabled={disabled}
            />
            {postalCodeError && (
              <p className="text-xs text-danger">{postalCodeError}</p>
            )}
          </div>
        )}

        {/* Sorting Code */}
        {countryConfig?.sorting_code_used && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="addr-sorting"
              text="Sorting Code / CEDEX"
              required={false}
            />
            <input
              id="addr-sorting"
              type="text"
              className={INPUT_CLASS}
              value={localData.sorting_code ?? ''}
              onChange={(e) => handleFieldChange('sorting_code', e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        {/* Privacy note */}
        {privacyNote && (
          <p
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: '#9CA3AF',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 4,
            }}
          >
            <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            {privacyNote}
          </p>
        )}

        {/* Formatted address preview */}
        <div>
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
            How it will display
          </p>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#374151',
              background: '#F9FAFB',
              borderLeft: '3px solid #E5E7EB',
              padding: '10px 14px',
              borderRadius: '0 4px 4px 0',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {preview || 'Enter an address to see preview'}
          </div>
        </div>
      </div>
    </div>
  );
}
