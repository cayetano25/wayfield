import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Admin route migration: numeric IDs only, so /workshops/5/leaders → /dashboard/workshops/5/leaders
      // but /workshops/photography-in-paris (slug) is untouched for future public SEO routes
      {
        source: '/workshops/:id(\\d+)/:path*',
        destination: '/dashboard/workshops/:id/:path*',
        permanent: true,
      },
      {
        source: '/workshops/:id(\\d+)',
        destination: '/dashboard/workshops/:id',
        permanent: true,
      },
      // /workshops (bare) only redirects if it was the old admin list — once the public
      // SEO route exists at /workshops this redirect must be removed
      {
        source: '/workshops',
        destination: '/dashboard/workshops',
        permanent: true,
      },
      // Legacy /w/[slug] public pages → new canonical public path /workshops/[slug]
      {
        source: '/w/:slug*',
        destination: '/workshops/:slug*',
        permanent: true,
      },
      // Legacy /discover → new canonical public discovery path
      {
        source: '/discover',
        destination: '/workshops',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;
