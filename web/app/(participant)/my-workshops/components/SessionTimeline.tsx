'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import type { ParticipantSession, ParticipantSessionLeader } from '@/lib/types/participant';
import type { SessionLocationResponse } from '@/lib/types/session-location';

/* --- Helpers ----------------------------------------------------------- */

function formatSessionTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const startTime = start.toLocaleTimeString('en-US', timeOpts);
  const endTime = end.toLocaleTimeString('en-US', timeOpts);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const dateStr = isToday ? 'Today' : start.toLocaleDateString('en-US', dateOpts);
  return `${dateStr} · ${startTime} – ${endTime}`;
}

/* --- Status dot -------------------------------------------------------- */

function StatusDot({ session }: { session: ParticipantSession }) {
  const isCompleted = session.attendance_status === 'checked_in';
  if (isCompleted) {
    return <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />;
  }
  if (session.is_next) {
    return <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[#0FA3B1]" />;
  }
  return <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-gray-300 bg-white" />;
}

/* --- Status badge ------------------------------------------------------ */

function StatusBadge({ session }: { session: ParticipantSession }) {
  const isCompleted = session.attendance_status === 'checked_in';
  const label = isCompleted ? 'Done' : session.is_next ? 'Next' : 'Upcoming';

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0 font-mono ${
        session.is_next
          ? 'bg-[#0FA3B1] text-white'
          : 'text-gray-400 border border-gray-200'
      }`}
    >
      {label}
    </span>
  );
}

/* --- Section label ----------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono mb-1">
      {children}
    </p>
  );
}

/* --- Location block ---------------------------------------------------- */

function LocationBlock({ location }: { location: SessionLocationResponse | null }) {
  if (!location || !location.type) {
    return (
      <div>
        <SectionLabel>Location</SectionLabel>
        <p className="text-sm text-gray-400">Location TBD</p>
      </div>
    );
  }

  const { type, name, notes, address, maps_url, latitude, longitude } = location;

  let addressLines: string[] = [];
  if (address?.formatted_address) {
    addressLines = [address.formatted_address];
  } else if (address) {
    if (address.address_line_1) addressLines.push(address.address_line_1);
    const cityState = [address.locality, address.administrative_area].filter(Boolean).join(', ');
    const withZip = [cityState, address.postal_code].filter(Boolean).join(' ');
    if (withZip) addressLines.push(withZip);
  } else if (type === 'coordinates' && latitude != null && longitude != null) {
    addressLines = [`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`];
  }

  return (
    <div>
      <SectionLabel>Location</SectionLabel>
      {type === 'hotel' && (
        <p className="text-xs text-gray-400 italic mb-0.5">Workshop hotel</p>
      )}
      {name && <p className="text-sm font-medium text-gray-900">{name}</p>}
      {addressLines.length > 0 && (
        <div className="text-xs text-gray-500 mt-0.5">
          {addressLines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}
      {notes && <p className="text-xs text-gray-400 mt-1">📌 {notes}</p>}
      {maps_url && (
        <a
          href={maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#0FA3B1] hover:underline mt-1 inline-block"
        >
          Open in Maps ↗
        </a>
      )}
    </div>
  );
}

/* --- Leader avatar ----------------------------------------------------- */

function LeaderAvatar({ leader }: { leader: ParticipantSessionLeader }) {
  if (leader.profile_image_url) {
    return (
      <Image
        src={leader.profile_image_url}
        alt={`${leader.first_name} ${leader.last_name}`}
        width={32}
        height={32}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  const initials = `${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`.toUpperCase();
  return (
    <div
      className="flex items-center justify-center font-sans font-semibold shrink-0 text-white"
      style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#0FA3B1', fontSize: 12 }}
    >
      {initials}
    </div>
  );
}

/* --- Leaders block ----------------------------------------------------- */

function LeadersBlock({ leaders }: { leaders: ParticipantSessionLeader[] }) {
  if (!leaders || leaders.length === 0) return null;
  return (
    <div>
      <SectionLabel>{leaders.length === 1 ? 'Session Leader' : 'Session Leaders'}</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {leaders.map((leader) => {
          const locationLine = [leader.city, leader.state_or_region].filter(Boolean).join(', ');
          return (
            <div key={leader.id} className="flex items-start gap-2.5">
              <LeaderAvatar leader={leader} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {leader.first_name} {leader.last_name}
                </p>
                {locationLine && <p className="text-xs text-gray-400">{locationLine}</p>}
                {leader.bio && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {leader.bio}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- SessionTimeline --------------------------------------------------- */

interface SessionTimelineProps {
  sessions: ParticipantSession[];
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (sessions.length === 0) return null;

  return (
    <div>
      {sessions.map((session) => {
        const isOpen = openId === session.id;
        const isCompleted = session.attendance_status === 'checked_in';

        return (
          <div key={session.id}>
            {/* Row */}
            <div
              className={`flex items-center gap-4 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-3 -mx-3 ${
                session.is_next ? 'bg-[#0FA3B1]/5' : ''
              }`}
              onClick={() => setOpenId(isOpen ? null : session.id)}
            >
              <StatusDot session={session} />

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug truncate ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
                  {session.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {formatSessionTime(session.start_at, session.end_at)}
                  {session.location_display ? ` · ${session.location_display}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge session={session} />
                <ChevronDown
                  size={14}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {/* Expanded detail panel */}
            {isOpen && (
              <div className="px-3 pb-4 pt-2 ml-6 flex flex-col gap-4">
                {session.description && (
                  <RichTextDisplay html={session.description} className="text-gray-500 text-sm" />
                )}
                <LocationBlock location={session.location ?? null} />
                <LeadersBlock leaders={session.leaders ?? []} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
