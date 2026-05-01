'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { ParticipantNextSession, ParticipantActiveWorkshop } from '@/lib/types/participant';

/* --- Helper ------------------------------------------------------------ */

export function formatSessionDateTime(session: ParticipantNextSession): string {
  const start = new Date(session.start_at);
  const end = new Date(session.end_at);
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const startTime = start.toLocaleTimeString('en-US', timeOpts);
  const endTime = end.toLocaleTimeString('en-US', timeOpts);
  if (isToday) return `Today · ${startTime} – ${endTime}`;
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', dateOpts)} · ${startTime} – ${endTime}`;
}

/* --- Props ------------------------------------------------------------- */

interface NextSessionCardProps {
  session: ParticipantNextSession | null;
  workshop: Pick<ParticipantActiveWorkshop, 'public_slug' | 'public_page_enabled'>;
}

/* --- Component --------------------------------------------------------- */

export function NextSessionCard({ session, workshop }: NextSessionCardProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.50)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      <div className="p-5">
        {/* Label */}
        <p
          className="font-bold uppercase mb-3"
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            color: '#0FA3B1',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Your Next Session
        </p>

        {session ? (
          <>
            {/* Session title */}
            <p
              className="font-heading font-bold text-white leading-snug mb-2"
              style={{ fontSize: 18 }}
            >
              {session.title}
            </p>

            {/* Date and time */}
            <div
              className="flex items-center gap-1.5 mb-4 font-sans"
              style={{ color: 'rgba(255,255,255,0.70)', fontSize: 13 }}
            >
              <CalendarDays size={13} className="shrink-0" />
              <span>{formatSessionDateTime(session)}</span>
            </div>

            {/* Status badge */}
            <div
              className="inline-flex items-center px-2.5 py-1 rounded-full mb-4 font-bold uppercase"
              style={{
                backgroundColor: 'rgba(15, 163, 177, 0.25)',
                border: '1px solid rgba(15, 163, 177, 0.40)',
                color: '#0FA3B1',
                fontSize: 10,
                letterSpacing: '0.10em',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {session.check_in_open ? 'Check-In Open' : 'Next Up'}
            </div>

            {/* View Details button */}
            {workshop.public_slug && workshop.public_page_enabled && (
              <Link
                href={`/workshops/${workshop.public_slug}`}
                className="w-full py-2.5 rounded-xl bg-[#0FA3B1] text-white font-semibold text-sm hover:bg-[#0c8a96] transition-colors text-center block font-sans"
              >
                View Details
              </Link>
            )}
          </>
        ) : (
          <p className="font-sans text-white/50 text-sm">
            No upcoming sessions scheduled.
          </p>
        )}
      </div>
    </div>
  );
}
