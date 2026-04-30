import { apiGet } from '@/lib/api/client';
import type { DiscoverWorkshop } from '@/lib/api/public';

export interface FavoritesResponse {
  data: DiscoverWorkshop[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export function getFavoriteWorkshops(page = 1): Promise<FavoritesResponse> {
  return apiGet<FavoritesResponse>(`/me/favorites?page=${page}`);
}
