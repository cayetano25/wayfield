import { apiGet } from './client';
import type { TaxonomyResponse } from '@/lib/types/taxonomy';

export function getTaxonomy(): Promise<TaxonomyResponse> {
  return apiGet<TaxonomyResponse>('/taxonomy');
}
