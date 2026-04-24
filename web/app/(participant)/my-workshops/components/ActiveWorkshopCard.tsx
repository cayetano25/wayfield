'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import toast from 'react-hot-toast';
import type { ParticipantActiveWorkshop } from '@/lib/types/participant';

/* --- Helpers ----------------------------------------------------------- */

function formatSessionWindow(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const startTime = start.toLocaleTimeString('en-US', timeOpts);
  const endTime = end.toLocaleTimeString('en-US', timeOpts);
  if (isToday) return `Today · ${startTime} – ${endTime}`;
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', dateOpts)} · ${startTime} – ${endTime}`;
}

/* --- ActiveWorkshopCard ------------------------------------------------ */

export function ActiveWorkshopCard({ workshop }: { workshop: ParticipantActiveWorkshop }) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const { next_session, sessions } = workshop;
  const allCheckedIn =
    sessions.length > 0 && sessions.every((s) => s.attendance_status === 'checked_in');

  const isSessionBased = workshop.workshop_type === 'session_based';
  const noSessionsSelected = isSessionBased && workshop.total_selected === 0;
  const partialSelection =
    isSessionBased &&
    workshop.total_selected > 0 &&
    workshop.total_selected < workshop.total_selectable;

  const selectSessionsHref = `/workshops/${workshop.workshop_id}/select-sessions`;

  async function handleCheckIn() {
    if (!next_session) return;
    setCheckingIn(true);
    try {
      await apiPost(`/sessions/${next_session.id}/attendance/self-checkin`);
      setCheckedIn(true);
      toast.success('Checked in successfully!');
    } catch {
      toast.error('Check-in failed. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  }

  const plainDescription = workshop.description
    ? workshop.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    : null;
  const descriptionExcerpt = plainDescription
    ? plainDescription.slice(0, 120) + (plainDescription.length > 120 ? '…' : '')
    : null;

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Header band — teal gradient */}
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)',
          padding: '20px 24px',
        }}
      >
        {/* Featured badge */}
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full font-sans font-semibold mb-3"
          style={{ fontSize: 10, color: 'white', backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          FEATURED WORKSHOP
        </span>

        <h2
          className="font-heading font-bold leading-snug"
          style={{ fontSize: 22, color: 'white' }}
        >
          {workshop.title}
        </h2>
        {descriptionExcerpt && (
          <p className="font-sans mt-1.5 leading-relaxed" style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            {descriptionExcerpt}
          </p>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        {checkedIn ? (
          /* Checked-in success state */
          <div className="flex items-center gap-3 py-2">
            <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: '#10B981' }} />
            <div>
              <p className="font-sans font-semibold" style={{ fontSize: 15, color: '#2E2E2E' }}>
                You&apos;re checked in!
              </p>
              <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
                {next_session?.title ?? 'Session'}
              </p>
            </div>
          </div>
        ) : allCheckedIn ? (
          /* All sessions complete */
          <div className="flex items-center gap-3 py-2">
            <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: '#10B981' }} />
            <p className="font-sans font-medium" style={{ fontSize: 15, color: '#6B7280' }}>
              All sessions complete
            </p>
          </div>
        ) : noSessionsSelected ? (
          /* -- Amber prompt: no sessions selected yet -- */
          <div
            className="flex items-start gap-3 rounded-lg"
            style={{
              borderLeft: '3px solid #E67E22',
              backgroundColor: '#FFFBF5',
              padding: '12px 14px',
            }}
          >
            <AlertTriangle
              className="shrink-0 mt-0.5"
              size={16}
              style={{ color: '#E67E22' }}
            />
            <div>
              <p
                className="font-sans font-medium"
                style={{ fontSize: 14, color: '#2E2E2E', marginBottom: 4 }}
              >
                You haven&apos;t selected your sessions yet.
              </p>
              <Link
                href={selectSessionsHref}
                className="font-sans font-bold hover:underline"
                style={{ fontSize: 14, color: '#0FA3B1' }}
              >
                Select sessions →
              </Link>
            </div>
          </div>
        ) : next_session ? (
          /* -- Next session -- */
          <div>
            <p
              className="font-sans font-semibold uppercase mb-2"
              style={{ fontSize: 11, letterSpacing: '0.08em', color: '#9CA3AF' }}
            >
              Your Next Session:
            </p>
            <h3
              className="font-heading font-bold mb-3 leading-snug"
              style={{ fontSize: 18, color: '#2E2E2E' }}
            >
              {next_session.title}
            </h3>

            <div className="flex flex-col gap-1.5 mb-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
                <span className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
                  {formatSessionWindow(next_session.start_at, next_session.end_at)}
                </span>
              </div>
              {next_session.location_display && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
                  <span className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
                    {next_session.location_display}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {next_session.check_in_open && (
                <Button size="md" onClick={handleCheckIn} loading={checkingIn}>
                  Check In
                </Button>
              )}
              {workshop.public_slug && workshop.public_page_enabled && (
                <Link href={`/w/${workshop.public_slug}`}>
                  <Button variant="secondary" size="md">
                    View Details
                  </Button>
                </Link>
              )}
              {workshop.public_slug && workshop.public_page_enabled && (
                <ShareWorkshopButton
                  workshopTitle={workshop.title}
                  publicUrl={`/w/${workshop.public_slug}`}
                  variant="participant"
                />
              )}
            </div>

            {/* -- Soft nudge when partial selection -- */}
            {partialSelection && (
              <div
                className="flex items-center justify-between rounded-lg mt-4"
                style={{
                  backgroundColor: '#F0FDFF',
                  padding: '10px 14px',
                  border: '1px solid #BAE6F0',
                }}
              >
                <p className="font-sans" style={{ fontSize: 13, color: '#374151' }}>
                  You&apos;ve selected{' '}
                  <strong>{workshop.total_selected}</strong> of{' '}
                  <strong>{workshop.total_selectable}</strong> available sessions.
                </p>
                <Link
                  href={selectSessionsHref}
                  className="font-sans font-semibold hover:underline shrink-0 ml-3"
                  style={{ fontSize: 13, color: '#0FA3B1' }}
                >
                  Add more →
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
