'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api/client';
import type { CountryConfig } from '@/lib/types/address';

let cachedCountries: CountryConfig[] | null = null;

export function useCountries() {
  const [countries, setCountries] = useState<CountryConfig[]>(cachedCountries ?? []);
  const [loading, setLoading] = useState(!cachedCountries);

  useEffect(() => {
    if (cachedCountries) return;
    apiGet<CountryConfig[]>('/address/countries')
      .then((data) => {
        cachedCountries = data;
        setCountries(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getCountryConfig(code: string): CountryConfig | null {
    return countries.find((c) => c.code === code) ?? null;
  }

  async function inferCountry(
    timezone: string,
  ): Promise<{ country_code: string; config: CountryConfig | null }> {
    try {
      const data = await apiGet<{
        country_code: string;
        country_name: string;
        config: CountryConfig | null;
      }>(`/address/infer-country?timezone=${encodeURIComponent(timezone)}`);
      return { country_code: data.country_code, config: data.config ?? null };
    } catch {
      return { country_code: 'US', config: null };
    }
  }

  return { countries, loading, getCountryConfig, inferCountry };
}
