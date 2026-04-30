'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Receipt } from 'lucide-react';
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
    <div
      className="bg-white relative"
      style={{ borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Status badge */}
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-semibold mb-3"
        style={{
          fontSize: 10,
          backgroundColor: isUpcoming ? '#EFF6FF' : '#F3F4F6',
          color: isUpcoming ? '#3B82F6' : '#6B7280',
        }}
      >
        {isUpcoming ? 'UPCOMING' : 'COMPLETED'}
      </span>

      {/* History icon top-right */}
      <div className="absolute top-4 right-4">
        <Clock className="w-5 h-5" style={{ color: '#D1D5DB' }} />
      </div>

      {/* Title */}
      <h3
        className="font-heading font-bold mb-1 leading-snug pr-8"
        style={{ fontSize: 16, color: '#2E2E2E' }}
      >
        {workshop.title}
      </h3>

      {/* View Receipt link — shown when an order exists */}
      {workshop.order_number && (
        <div className="mb-1">
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
      {workshop.series ? (
        <p className="font-sans mb-2" style={{ fontSize: 12, color: '#6B7280' }}>
          {workshop.series}
        </p>
      ) : (
        <p className="font-sans mb-2" style={{ fontSize: 12, color: '#6B7280' }}>
          {formatDateRange(workshop.start_date, workshop.end_date)}
        </p>
      )}

      {/* Payment status badge */}
      {workshop.payment_status && workshop.payment_status !== 'Free' && (
        <div className="mb-2">
          <PaymentStatusBadge
            status={workshop.payment_status as PaymentStatus}
            balanceDueDate={workshop.balance_due_date}
            orderNumber={workshop.order_number}
          />
        </div>
      )}

      {/* Tier pricing label */}
      {workshop.is_tier_price && workshop.applied_tier_label && (
        <p className="font-sans mb-2" style={{ fontSize: 12, color: '#6B7280' }}>
          Registered at {workshop.applied_tier_label} price
        </p>
      )}

      {/* Bottom: session count + check-in rate + view details */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-medium"
            style={{ fontSize: 11, backgroundColor: '#F3F4F6', color: '#6B7280' }}
          >
            {workshop.sessions_count} session{workshop.sessions_count !== 1 ? 's' : ''}
          </span>
          {!isUpcoming && checkInRate !== null && (
            <span
              className="font-sans font-medium"
              style={{ fontSize: 11, color: '#9CA3AF' }}
            >
              {checkInRate}% attended
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {workshop.public_slug && workshop.public_page_enabled && (
            <Link
              href={`/w/${workshop.public_slug}`}
              className="font-sans font-semibold hover:underline shrink-0"
              style={{ fontSize: 12, color: '#0FA3B1' }}
            >
              View Details →
            </Link>
          )}
          {workshop.public_slug && workshop.public_page_enabled && (
            <ShareWorkshopButton
              workshopTitle={workshop.title}
              publicUrl={`/w/${workshop.public_slug}`}
              variant="participant"
              className="p-1 rounded text-gray-400 hover:text-[#0FA3B1] hover:bg-[#F0FDFF] transition-colors"
            />
          )}
        </div>
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

/* --- OtherWorkshopsGrid -------------------------------------------------- */

interface OtherWorkshopsGridProps {
  workshops: ParticipantOtherWorkshop[];
  onJoined: () => void;
}

export function OtherWorkshopsGrid({ workshops, onJoined }: OtherWorkshopsGridProps) {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div>
      <h2
        className="font-heading font-bold mb-4"
        style={{ fontSize: 18, color: '#2E2E2E' }}
      >
        Other Workshops
      </h2>

      {workshops.length === 0 ? (
        <p className="font-sans text-center py-6" style={{ fontSize: 13, color: '#9CA3AF' }}>
          No other workshops
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {workshops.map((w) => (
            <OtherWorkshopCard key={w.workshop_id} workshop={w} />
          ))}
        </div>
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

      <JoinWorkshopModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={onJoined}
      />
    </div>
  );
}
