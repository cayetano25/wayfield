'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { apiDelete } from '@/lib/api/client';

/* --- Types ---------------------------------------------------------------- */

export interface RemoveParticipantTarget {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RemoveParticipantModalProps {
  open: boolean;
  participant: RemoveParticipantTarget | null;
  sessionId: number;
  onClose: () => void;
  onSuccess: () => void;
}

/* --- Component ------------------------------------------------------------ */

export function RemoveParticipantModal({
  open,
  participant,
  sessionId,
  onClose,
  onSuccess,
}: RemoveParticipantModalProps) {
  const [reason, setReason] = useState('');
  const [notifyParticipant, setNotifyParticipant] = useState(false);
  const [removing, setRemoving] = useState(false);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setReason('');
      setNotifyParticipant(false);
    }
  }, [open]);

  async function handleRemove() {
    if (!participant) return;
    setRemoving(true);
    try {
      await apiDelete(`/sessions/${sessionId}/participants/${participant.user_id}`, {
        reason: reason.trim() || null,
        notify_participant: notifyParticipant,
      });
      toast.success(`${participant.first_name} ${participant.last_name} removed from session`);
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to remove participant. Please try again.');
    } finally {
      setRemoving(false);
    }
  }

  if (!participant) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove participant"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button
            onClick={handleRemove}
            loading={removing}
            className="bg-danger hover:bg-danger/90 text-white border-danger"
          >
            Confirm Remove
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-dark">
          Remove{' '}
          <span className="font-semibold">
            {participant.first_name} {participant.last_name}
          </span>{' '}
          from this session? Their selection will be cancelled (not deleted) for auditing purposes.
        </p>

        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Participant rescheduled to Group B"
        />

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifyParticipant}
            onChange={(e) => setNotifyParticipant(e.target.checked)}
            className="w-4 h-4 rounded border-border-gray accent-primary"
          />
          <span className="text-sm text-dark">Notify participant of removal</span>
        </label>
      </div>
    </Modal>
  );
}
