'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Bell, Clock, Info, Loader2, X } from 'lucide-react';
import { apiPost, ApiError } from '@/lib/api/client';

type NotificationType = 'informational' | 'urgent' | 'reminder';

interface Props {
  open: boolean;
  sessionId: number;
  sessionTitle: string;
  participantCount: number;
  onClose: () => void;
  onSuccess: (recipientCount: number) => void;
}

interface SendNotificationResponse {
  recipient_count?: number;
  notification?: { recipient_count?: number };
}

const TYPES = [
  { value: 'informational' as const, label: 'Informational', color: '#0FA3B1', Icon: Info },
  { value: 'urgent' as const, label: 'Urgent', color: '#E94F37', Icon: AlertCircle },
  { value: 'reminder' as const, label: 'Reminder', color: '#E67E22', Icon: Clock },
];

export function LeaderNotificationComposeModal({
  open,
  sessionId,
  sessionTitle,
  participantCount,
  onClose,
  onSuccess,
}: Props) {
  const [notificationType, setNotificationType] = useState<NotificationType>('informational');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        setTitle('');
        setMessage('');
        setNotificationType('informational');
        setError(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  function handleClose() {
    if (submitting) return;
    setTitle('');
    setMessage('');
    setNotificationType('informational');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<SendNotificationResponse>(
        `/sessions/${sessionId}/notifications`,
        { title: title.trim(), message: message.trim(), notification_type: notificationType },
      );
      const count =
        res?.recipient_count ??
        res?.notification?.recipient_count ??
        participantCount;
      setTitle('');
      setMessage('');
      setNotificationType('informational');
      setError(null);
      onSuccess(count);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const msg = err.message.toLowerCase();
          if (msg.includes('participant') || msg.includes('enrolled')) {
            setError('No participants are enrolled in this session.');
          } else {
            setError("This session's messaging window is not currently open.");
          }
        } else if (err.status === 403) {
          setError('You are not assigned to this session.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-white flex flex-col"
        style={{ borderRadius: 16, boxShadow: '0 24px 64px rgba(46,46,46,0.18)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between shrink-0"
          style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}
        >
          <div>
            <h2 className="font-heading font-bold" style={{ fontSize: 18, color: '#2E2E2E' }}>
              Send Notification
            </h2>
            <p className="font-sans mt-1" style={{ fontSize: 13, color: '#9CA3AF' }}>
              To: {participantCount} participant{participantCount !== 1 ? 's' : ''} in {sessionTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-gray-100 disabled:opacity-50"
            style={{ color: '#6B7280' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
          {/* Notification type segmented control */}
          <div style={{ marginBottom: 20 }}>
            <p
              className="font-sans font-semibold"
              style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Type
            </p>
            <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: '#F3F4F6' }}>
              {TYPES.map(({ value, label, color, Icon }) => {
                const active = notificationType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNotificationType(value)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 font-sans font-semibold rounded-lg transition-all"
                    style={{
                      fontSize: 13,
                      minHeight: 44,
                      backgroundColor: active ? 'white' : 'transparent',
                      color: active ? color : '#6B7280',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label
              className="font-sans font-semibold"
              style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 255))}
              placeholder="Notification title"
              maxLength={255}
              disabled={submitting}
              className="w-full font-sans rounded-lg disabled:opacity-50"
              style={{
                fontSize: 14,
                padding: '10px 14px',
                minHeight: 44,
                color: '#2E2E2E',
                border: '1.5px solid #E5E7EB',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0FA3B1'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
          </div>

          {/* Message */}
          <div>
            <label
              className="font-sans font-semibold"
              style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Message
            </label>
            <div className="relative">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 500))}
                placeholder="Write your message to session participants..."
                maxLength={500}
                rows={4}
                disabled={submitting}
                className="w-full font-sans rounded-lg resize-none disabled:opacity-50"
                style={{
                  fontSize: 14,
                  padding: '10px 14px 28px',
                  color: '#2E2E2E',
                  border: '1.5px solid #E5E7EB',
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0FA3B1'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />
              <span
                className="absolute bottom-2 right-3 font-sans select-none pointer-events-none"
                style={{ fontSize: 11, color: message.length >= 480 ? '#E94F37' : '#9CA3AF' }}
              >
                {message.length} / 500
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg mt-4"
              style={{ padding: '10px 14px', backgroundColor: '#FEE2E2' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#B91C1C' }} />
              <p className="font-sans" style={{ fontSize: 13, color: '#B91C1C' }}>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6' }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="font-sans font-semibold rounded-lg transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: 14, padding: '10px 20px', minHeight: 44, color: '#6B7280' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontSize: 14,
              padding: '10px 24px',
              minHeight: 44,
              minWidth: 160,
              backgroundColor: '#0FA3B1',
              color: 'white',
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Send Notification
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
