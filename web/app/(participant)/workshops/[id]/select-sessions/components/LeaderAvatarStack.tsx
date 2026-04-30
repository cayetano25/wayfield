'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { SessionLeaderSummary } from '@/lib/types/session-selection';

interface Props {
  leaders: SessionLeaderSummary[];
  maxDisplay?: number;
}

function SingleAvatar({ leader }: { leader: SessionLeaderSummary }) {
  const [failed, setFailed] = useState(false);
  const initials =
    `${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`.toUpperCase();

  if (leader.profile_image_url && !failed) {
    return (
      <Image
        src={leader.profile_image_url}
        alt={`${leader.first_name} ${leader.last_name}`}
        width={20}
        height={20}
        className="rounded-full object-cover"
        style={{ border: '1.5px solid white' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: 20,
        height: 20,
        backgroundColor: '#0FA3B1',
        border: '1.5px solid white',
        fontSize: 7,
        fontFamily: 'var(--font-heading, Sora, sans-serif)',
        fontWeight: 600,
        color: 'white',
        letterSpacing: 0,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export function LeaderAvatarStack({ leaders, maxDisplay = 3 }: Props) {
  if (!leaders.length) return null;

  const visible = leaders.slice(0, maxDisplay);
  const overflow = leaders.length - maxDisplay;

  return (
    <div className="flex items-center shrink-0">
      {visible.map((leader, i) => (
        <div
          key={i}
          style={{ marginLeft: i === 0 ? 0 : -6, position: 'relative', zIndex: maxDisplay - i }}
        >
          <SingleAvatar leader={leader} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 20,
            height: 20,
            backgroundColor: '#9CA3AF',
            border: '1.5px solid white',
            marginLeft: -6,
            fontSize: 7,
            color: 'white',
            fontWeight: 600,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
