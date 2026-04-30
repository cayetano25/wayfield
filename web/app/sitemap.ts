import type { MetadataRoute } from 'next';
import {
  getSitemapWorkshops,
  getSitemapCategories,
  getSitemapLeaders,
} from '@/lib/api/public';

export const revalidate = 3600;

const BASE_URL = 'https://wayfield.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let workshops: Awaited<ReturnType<typeof getSitemapWorkshops>> = [];
  let categories: Awaited<ReturnType<typeof getSitemapCategories>> = [];
  let leaders: Awaited<ReturnType<typeof getSitemapLeaders>> = [];

  // Fetch all three in parallel — fail gracefully if backend unavailable
  try {
    [workshops, categories, leaders] = await Promise.all([
      getSitemapWorkshops(),
      getSitemapCategories(),
      getSitemapLeaders(),
    ]);
  } catch {
    // Return static routes only if backend is unreachable
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/workshops`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  const workshopRoutes: MetadataRoute.Sitemap = workshops.map((w) => ({
    url: `${BASE_URL}/workshops/${w.public_slug}`,
    lastModified: new Date(w.updated_at),
    changeFrequency: 'weekly',
    priority: w.priority,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/workshops/${c.slug}`,
    lastModified: new Date(c.updated_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const leaderRoutes: MetadataRoute.Sitemap = leaders.map((l) => ({
    url: `${BASE_URL}/leaders/${l.slug}`,
    lastModified: new Date(l.updated_at),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...workshopRoutes, ...categoryRoutes, ...leaderRoutes];
}
