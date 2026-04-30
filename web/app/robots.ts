import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/w/',
        '/admin/',
      ],
    },
    sitemap: 'https://wayfield.app/sitemap.xml',
  };
}
