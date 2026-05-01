'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import { NextSessionCard, formatSessionDateTime } from '@/components/workshops/NextSessionCard';
import toast from 'react-hot-toast';
import type { ParticipantActiveWorkshop } from '@/lib/types/participant';

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

  const selectSessionsHref = `/my-workshops/${workshop.workshop_id}/select-sessions`;

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
    ? plainDescription.slice(0, 160) + (plainDescription.length > 160 ? '…' : '')
    : null;

  return (
    <>
      {/* ── Photography hero ─────────────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden"
        style={{ borderRadius: 16, minHeight: '50vh' }}
      >
        {/* Background */}
        <div className="absolute inset-0">
          {workshop.header_image_url ? (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${workshop.header_image_url})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0FA3B1] via-[#0c8a96] to-[#1a3a4a]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/72" />
        </div>

        {/* Content */}
        <div
          className="relative z-10 flex flex-col lg:flex-row lg:items-end px-6 lg:px-8 pt-14 pb-8 gap-5"
          style={{ minHeight: '50vh' }}
        >
          {/* ── Left: workshop identity ───────────────────────────── */}
          <div className="flex-1 min-w-0 lg:pr-6">

            {/* Featured Workshop badge */}
            <div
              className="inline-flex items-center px-3 py-1 rounded-full mb-4"
              style={{
                backgroundColor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                fontSize: 10,
                color: 'white',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              Featured Workshop
            </div>

            {/* Title */}
            <h1
              className="font-heading font-bold text-white leading-tight mb-2"
              style={{ fontSize: 'clamp(22px, 4vw, 36px)' }}
            >
              {workshop.title}
            </h1>

            {/* Description */}
            {descriptionExcerpt && (
              <p
                className="font-sans leading-relaxed mb-5 line-clamp-2"
                style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', maxWidth: 480 }}
              >
                {descriptionExcerpt}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Check In — shown when session is imminent and not yet checked in */}
              {next_session?.check_in_open && !checkedIn && (
                <Button size="md" onClick={handleCheckIn} loading={checkingIn}>
                  Check In
                </Button>
              )}

              {workshop.public_slug && workshop.public_page_enabled && (
                <Link
                  href={`/workshops/${workshop.public_slug}`}
                  className="inline-flex items-center font-sans font-bold rounded-lg transition-all hover:bg-white/10 active:scale-[0.98]"
                  style={{
                    fontSize: 14,
                    padding: '9px 20px',
                    border: '1.5px solid rgba(255,255,255,0.55)',
                    color: 'white',
                  }}
                >
                  View Details
                </Link>
              )}

              {workshop.public_slug && workshop.public_page_enabled && (
                <ShareWorkshopButton
                  workshopTitle={workshop.title}
                  publicUrl={`/workshops/${workshop.public_slug}`}
                  variant="organizer"
                  showLabel
                  className="border-white/55 text-white !bg-transparent hover:!bg-white/10 hover:border-white/70 active:scale-[0.98]"
                />
              )}
            </div>

            {/* Checked-in success indicator */}
            {checkedIn && (
              <div className="flex items-center gap-2 mt-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="font-sans font-semibold text-white" style={{ fontSize: 13 }}>
                  You&apos;re checked in!
                </p>
              </div>
            )}

            {/* All sessions complete indicator */}
            {!checkedIn && allCheckedIn && (
              <div className="flex items-center gap-2 mt-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="font-sans font-medium text-white/80" style={{ fontSize: 13 }}>
                  All sessions complete
                </p>
              </div>
            )}

            {/* No sessions selected — prompt */}
            {noSessionsSelected && (
              <Link
                href={selectSessionsHref}
                className="inline-flex items-center mt-4 font-sans font-bold rounded-lg bg-white text-[#0FA3B1] hover:bg-white/90 transition-colors"
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                Select Sessions →
              </Link>
            )}

            {/* Partial-selection nudge */}
            {partialSelection && (
              <div
                className="flex items-center justify-between rounded-xl mt-5"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '10px 14px',
                }}
              >
                <p className="font-sans text-white/80" style={{ fontSize: 13 }}>
                  You&apos;ve selected{' '}
                  <strong>{workshop.total_selected}</strong> of{' '}
                  <strong>{workshop.total_selectable}</strong> available time slots.
                </p>
                <Link
                  href={selectSessionsHref}
                  className="font-sans font-semibold hover:underline shrink-0 ml-3 text-white"
                  style={{ fontSize: 13 }}
                >
                  Add more →
                </Link>
              </div>
            )}
          </div>

          {/* ── Right: glass card (desktop only) ─────────────────── */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <NextSessionCard session={next_session} workshop={workshop} />
          </div>
        </div>
      </section>

      {/* ── Mobile: simplified next-session strip ────────────────── */}
      {next_session && (
        <div className="lg:hidden px-4 py-4 bg-white border-b border-gray-100 rounded-xl mt-2"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <p
            className="font-bold uppercase mb-1"
            style={{
              fontSize: 10,
              letterSpacing: '0.15em',
              color: '#9CA3AF',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Your Next Session
          </p>
          <p className="font-sans font-semibold text-gray-900" style={{ fontSize: 14 }}>
            {next_session.title}
          </p>
          <p className="font-sans mt-0.5" style={{ fontSize: 13, color: '#6B7280' }}>
            {formatSessionDateTime(next_session)}
          </p>
        </div>
      )}
    </>
  );
}
