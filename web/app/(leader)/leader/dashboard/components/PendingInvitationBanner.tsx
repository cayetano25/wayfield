'use client';

import { useState } from 'react';
import { GraduationCap, CheckCircle2, X } from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import toast from 'react-hot-toast';
import type { LeaderPendingInvitation } from '@/lib/types/leader';

interface PendingInvitationBannerProps {
  invitations: LeaderPendingInvitation[];
  onResolved: () => void;
}

function InvitationCard({
  invitation,
  onResolved,
}: {
  invitation: LeaderPendingInvitation;
  onResolved: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      await apiPost(`/leader/invitations/${invitation.token}/accept`, {});
      toast.success('Invitation accepted!');
      onResolved();
    } catch {
      toast.error('Could not accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      await apiPost(`/leader/invitations/${invitation.token}/decline`, {});
      toast.success('Invitation declined.');
      onResolved();
    } catch {
      toast.error('Could not decline invitation. Please try again.');
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div
      className="bg-white flex items-start gap-4"
      style={{
        borderRadius: 12,
        padding: '16px 20px',
        borderLeft: '4px solid #E67E22',
        backgroundColor: '#FFFBF5',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Icon */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: '#FEF3C7' }}
      >
        <GraduationCap className="w-5 h-5" style={{ color: '#D97706' }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold mb-0.5" style={{ fontSize: 15, color: '#2E2E2E' }}>
          Leader invitation from {invitation.organization_name}
        </p>
        <p className="font-sans mb-3" style={{ fontSize: 13, color: '#6B7280' }}>
          {invitation.workshop_title}
          {invitation.workshop_dates ? ` · ${invitation.workshop_dates}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting || declining}
            className="inline-flex items-center gap-1.5 font-sans font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{
              fontSize: 13,
              padding: '7px 14px',
              backgroundColor: '#0FA3B1',
              color: 'white',
            }}
          >
            {accepting ? (
              'Accepting…'
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accept
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={accepting || declining}
            className="inline-flex items-center gap-1.5 font-sans font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{
              fontSize: 13,
              padding: '7px 14px',
              backgroundColor: 'white',
              color: '#6B7280',
              border: '1px solid #E5E7EB',
            }}
          >
            {declining ? (
              'Declining…'
            ) : (
              <>
                <X className="w-3.5 h-3.5" />
                Decline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PendingInvitationBanner({ invitations, onResolved }: PendingInvitationBannerProps) {
  if (invitations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-6">
      {invitations.map((inv) => (
        <InvitationCard key={inv.invitation_id} invitation={inv} onResolved={onResolved} />
      ))}
    </div>
  );
}
