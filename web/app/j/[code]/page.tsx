import { headers } from 'next/headers';
import type { Metadata } from 'next';
import JoinPageClient from './JoinPageClient';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

async function fetchJoinCodeMeta(code: string) {
  try {
    const res = await fetch(`${BASE_URL}/join/${code}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const data = await fetchJoinCodeMeta(code.toUpperCase());
  const isValid = data?.join_code?.is_valid === true;

  const base: Metadata = {
    robots: { index: false, follow: false },
  };

  if (!isValid || !data?.workshop) {
    return { ...base, title: 'Invalid Join Code — Wayfield' };
  }

  const w = data.workshop;
  const description = w.public_summary ?? (w.description ?? '').slice(0, 200);

  return {
    ...base,
    title: `Join ${w.title} on Wayfield`,
    description,
    other: {
      'apple-itunes-app': `app-id=YOUR_APP_STORE_ID, app-argument=https://wayfield.app/j/${code.toUpperCase()}`,
    },
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  // Server-side mobile detection to avoid layout shift on first render
  const headersList = await headers();
  const ua = headersList.get('user-agent') ?? '';
  const isMobileSsr = /android|iphone|ipad|ipod/i.test(ua);

  // Data fetching is done client-side in JoinPageClient so that Playwright
  // page.route() mocks work correctly during testing. generateMetadata above
  // does the server-side fetch for Open Graph tags only.
  return <JoinPageClient code={upperCode} isMobileSsr={isMobileSsr} />;
}
