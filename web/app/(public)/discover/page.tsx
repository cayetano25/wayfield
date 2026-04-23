import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiscoverClient } from './DiscoverClient';

export const metadata: Metadata = {
  title: 'Browse Workshops | Wayfield',
  description: 'Discover and join photography workshops and creative events curated on Wayfield.',
};

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverClient />
    </Suspense>
  );
}
