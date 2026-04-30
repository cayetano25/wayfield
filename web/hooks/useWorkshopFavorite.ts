'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api/client';
import { getToken } from '@/lib/auth/session';

interface ToggleResponse {
  data: {
    workshop_id: number;
    favorited: boolean;
    favorites_count: number;
  };
}

export function useWorkshopFavorite(workshopId: number, initialFavorited: boolean) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const toggle = useCallback(async () => {
    if (!getToken()) {
      router.push('/login?return=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setIsFavorited((prev) => !prev);

    try {
      const res = await apiPost<ToggleResponse>(`/workshops/${workshopId}/favorite`);
      setIsFavorited(res.data.favorited);
    } catch {
      setIsFavorited((prev) => !prev);
    } finally {
      setIsLoading(false);
    }
  }, [workshopId, isLoading, router]);

  return { isFavorited, toggle, isLoading };
}
