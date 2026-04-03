import { cookies } from 'next/headers';
import { AnnouncementBannerClient, type Announcement } from './AnnouncementBannerClient';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

async function fetchAnnouncements(token: string | undefined): Promise<Announcement[]> {
  try {
    const res = await fetch(`${API_BASE}/system/announcements`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data: Announcement[] = json.data ?? json ?? [];
    return data.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
  } catch {
    return [];
  }
}

export async function SystemAnnouncementBanner() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wayfield_token')?.value;
  const announcements = await fetchAnnouncements(token);

  if (announcements.length === 0) return null;

  return <AnnouncementBannerClient announcements={announcements} />;
}
