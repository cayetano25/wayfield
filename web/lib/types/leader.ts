export interface SessionLeader {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  city: string | null;
  state_or_region: string | null;
  role_label: string | null;
  phone_number: string | null;
  phone_visible: boolean;
}

export function leaderFullName(leader: SessionLeader): string {
  return `${leader.first_name} ${leader.last_name}`.trim();
}

export function leaderLocation(leader: SessionLeader): string | null {
  const parts = [leader.city, leader.state_or_region].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
