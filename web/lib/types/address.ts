export interface CountryConfig {
  code: string;
  name: string;
  postal_code_label: string;
  postal_code_required: boolean;
  postal_code_format: string | null;
  administrative_area_label: string;
  administrative_area_required: boolean;
  administrative_area_options: Record<string, string> | null;
  locality_label: string;
  locality_required: boolean;
  dependent_locality_label: string | null;
  address_line_3_used?: boolean;
  sorting_code_used?: boolean;
}

export interface AddressFormData {
  country_code: string;
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  locality: string;
  administrative_area?: string;
  dependent_locality?: string;
  postal_code?: string;
  sorting_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressApiResponse extends AddressFormData {
  country_name: string;
  formatted_address: string;
  validation_status: 'unverified' | 'verified' | 'failed';
}
