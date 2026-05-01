'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Receipt } from 'lucide-react';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import { PaymentStatusBadge } from '@/components/workshops/pricing/PaymentStatusBadge';
import { apiPost } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import type { ParticipantOtherWorkshop } from '@/lib/types/participant';
import type { PaymentStatus } from '@/components/workshops/pricing/PaymentStatusBadge';

/* --- Helpers ----------------------------------------------------------- */

function formatDateRange(start: string, end: string): string {
  if (!start) return '';
  const [sy, sm, sd] = start.split('-').map(Number);
  const endStr = end || start;
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDt = new Date(sy, sm - 1, sd);
  const endDt = new Date(ey, em - 1, ed);
  if (start === endStr) {
    return startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (sm === em && sy === ey) {
    return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${ed}, ${sy}`;
  }
  return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/* --- Workshop card ------------------------------------------------------ */

function OtherWorkshopCard({ workshop }: { workshop: ParticipantOtherWorkshop }) {
  const isUpcoming = workshop.status === 'upcoming';
  const checkInRate =
    workshop.total_sessions > 0
      ? Math.round((workshop.checked_in_count / workshop.total_sessions) * 100)
      : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex">
        {/* Photo strip — left, 112px wide */}
        <div className="w-28 flex-shrink-0 relative min-h-[120px]">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #1a3a4a 100%)' }}
          />
        </div>

        {/* Content — right */}
        <div className="flex-1 p-5 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Status badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide font-mono mb-2 ${
                  isUpcoming
                    ? 'bg-[#0FA3B1]/10 text-[#0FA3B1]'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isUpcoming ? 'Upcoming' : 'Completed'}
              </span>

              {/* Title */}
              <p className="font-heading font-bold text-gray-900 leading-snug truncate">
                {workshop.title}
              </p>

              {/* Receipt link */}
              {workshop.order_number && (
                <div className="mt-0.5">
                  <Link
                    href={`/account/receipts/${workshop.order_number}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0FA3B1] hover:underline"
                  >
                    <Receipt size={11} />
                    View Receipt
                  </Link>
                </div>
              )}

              {/* Series / date */}
              <p className="text-sm text-gray-500 mt-0.5">
                {workshop.series || formatDateRange(workshop.start_date, workshop.end_date)}
              </p>

              {/* Payment status badge */}
              {workshop.payment_status && workshop.payment_status !== 'Free' && (
                <div className="mt-1">
                  <PaymentStatusBadge
                    status={workshop.payment_status as PaymentStatus}
                    balanceDueDate={workshop.balance_due_date}
                    orderNumber={workshop.order_number}
                  />
                </div>
              )}

              {/* Tier pricing */}
              {workshop.is_tier_price && workshop.applied_tier_label && (
                <p className="text-xs text-gray-500 mt-1">
                  Registered at {workshop.applied_tier_label} price
                </p>
              )}
            </div>

            {/* Share button */}
            {workshop.public_slug && workshop.public_page_enabled && (
              <ShareWorkshopButton
                workshopTitle={workshop.title}
                publicUrl={`/workshops/${workshop.public_slug}`}
                variant="participant"
                className="p-1 rounded text-gray-400 hover:text-[#0FA3B1] hover:bg-[#F0FDFF] transition-colors flex-shrink-0"
              />
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                {workshop.sessions_count} session{workshop.sessions_count !== 1 ? 's' : ''}
              </span>
              {!isUpcoming && checkInRate !== null && (
                <span className="text-xs text-gray-400">{checkInRate}% attended</span>
              )}
            </div>
            {workshop.public_slug && workshop.public_page_enabled && (
              <Link
                href={`/workshops/${workshop.public_slug}`}
                className="text-xs font-semibold text-[#0FA3B1] hover:underline shrink-0"
              >
                View Details →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Discover strip ---------------------------------------------------- */

function DiscoverStrip() {
  return (
    <div className="border-t border-gray-100 pt-10 mt-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-heading font-bold text-gray-900" style={{ fontSize: 18 }}>
            Discover more workshops
          </h2>
          <p className="text-sm text-gray-500 mt-1">Continue your creative journey.</p>
        </div>
        <Link
          href="/discover"
          className="text-sm font-medium text-[#0FA3B1] hover:text-[#0c8a96] flex items-center gap-1 transition-colors"
        >
          Browse all <ArrowRight size={14} />
        </Link>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
        <p className="text-gray-400 text-sm mb-4">
          Explore all available workshops and find your next experience.
        </p>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 bg-[#0FA3B1] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#0c8a96] transition-colors"
        >
          Explore Workshops <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/* --- Join workshop modal ------------------------------------------------ */

function JoinWorkshopModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setJoining(true);
    try {
      await apiPost('/workshops/join', { join_code: trimmed });
      toast.success('Joined workshop!');
      setCode('');
      onClose();
      onJoined();
    } catch {
      toast.error('Invalid join code. Please check with your organizer.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join a Workshop"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleJoin} loading={joining} disabled={!code.trim()}>
            Join
          </Button>
        </>
      }
    >
      <p className="text-sm text-medium-gray mb-4 leading-relaxed">
        Ask your organizer for the workshop join code to get access.
      </p>
      <Input
        label="Join Code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="e.g. ABC123"
        className="font-mono tracking-widest"
        onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin(); }}
      />
    </Modal>
  );
}

/* --- OtherWorkshopsGrid ------------------------------------------------- */

interface OtherWorkshopsGridProps {
  workshops: ParticipantOtherWorkshop[];
  onJoined: () => void;
}

export function OtherWorkshopsGrid({ workshops, onJoined }: OtherWorkshopsGridProps) {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div>
      {workshops.length > 0 && (
        <>
          <h2
            className="font-heading font-bold mb-4"
            style={{ fontSize: 18, color: '#2E2E2E' }}
          >
            Other Workshops
          </h2>

          <div className="space-y-4 mb-6">
            {workshops.map((w) => (
              <OtherWorkshopCard key={w.workshop_id} workshop={w} />
            ))}
          </div>
        </>
      )}

      {/* Join Another Workshop CTA */}
      <button
        type="button"
        onClick={() => setJoinOpen(true)}
        className="w-full font-sans flex items-center justify-center bg-white transition-colors hover:bg-[#FAFAFA]"
        style={{
          height: 48,
          fontSize: 13,
          color: '#9CA3AF',
          borderRadius: 12,
          border: '1.5px dashed #D1D5DB',
        }}
      >
        + Join Another Workshop
      </button>

      {/* Discover strip */}
      <DiscoverStrip />

      <JoinWorkshopModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={onJoined}
      />
    </div>
  );
}
