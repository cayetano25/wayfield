'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { SessionLeader } from '@/lib/types/leader';

interface LeaderAvatarProps {
  leader: Pick<SessionLeader, 'first_name' | 'last_name' | 'profile_image_url'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { box: 'w-8 h-8',   text: 'text-[12px]', px: 32  },
  md: { box: 'w-14 h-14', text: 'text-[18px]', px: 56  },
  lg: { box: 'w-20 h-20', text: 'text-[24px]', px: 80  },
} as const;

export function LeaderAvatar({ leader, size = 'md', className = '' }: LeaderAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const { box, text, px } = sizeClasses[size];

  const initials = `${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`.toUpperCase();
  const base = `${box} rounded-full overflow-hidden shrink-0 ${className}`;

  if (leader.profile_image_url && !imgFailed) {
    return (
      <div className={base}>
        <Image
          src={leader.profile_image_url}
          alt={`${leader.first_name} ${leader.last_name}, Workshop Leader`}
          width={px}
          height={px}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} flex items-center justify-center`}
      style={{ backgroundColor: '#0FA3B1' }}
    >
      <span className={`font-heading font-semibold text-white select-none ${text}`}>
        {initials}
      </span>
    </div>
  );
}
