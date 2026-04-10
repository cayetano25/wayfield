'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { apiPost } from '@/lib/api/client';
import { ActiveWorkshopCard } from './components/ActiveWorkshopCard';
import { SessionTimeline } from './components/SessionTimeline';
import { WorkshopInfoCard } from './components/WorkshopInfoCard';
import { OtherWorkshopsGrid } from './components/OtherWorkshopsGrid';
import type { ParticipantDashboard } from '@/lib/types/participant';
import toast from 'react-hot-toast';

/* ─── Skeleton ────────────────────────────────────────────────────────── */

function Skeleton({ height, className = '' }: { height: number; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'participantShimmer 1.4s infinite',
      }}
    />
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */

function EmptyState({ onJoined }: { onJoined: () => void }) {
  const [joinOpen, setJoinOpen] = useState(false);
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
      setJoinOpen(false);
      onJoined();
    } catch {
      toast.error('Invalid join code. Please check with your organizer.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <div
        className="bg-white flex flex-col items-center text-center"
        style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-center mb-5" style={{ fontSize: 48 }}>
          🎯
        </div>
        <h2
          className="font-heading font-bold mb-2"
          style={{ fontSize: 20, color: '#2E2E2E' }}
        >
          You haven&apos;t joined any workshops yet
        </h2>
        <p className="font-sans mb-8 max-w-xs leading-relaxed" style={{ fontSize: 14, color: '#6B7280' }}>
          Ask your workshop organizer for a join code to get started.
        </p>
        <Button size="lg" onClick={() => setJoinOpen(true)}>
          <Plus className="w-4 h-4" />
          Join a Workshop
        </Button>
      </div>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a Workshop"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setJoinOpen(false)}>
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
    </>
  );
}

/* ─── Error state ─────────────────────────────────────────────────────── */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="bg-white flex flex-col items-center text-center gap-4"
      style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
      <div>
        <p className="font-heading font-semibold mb-1" style={{ color: '#2E2E2E' }}>
          Could not load your workshops
        </p>
        <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
          Check your connection and try again.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function MyWorkshopsPage() {
  const router = useRouter();
  const [data, setData] = useState<ParticipantDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet<ParticipantDashboard>('/me/dashboard')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isEmpty =
    !loading &&
    !error &&
    data?.active_workshop === null &&
    (data?.other_workshops ?? []).length === 0;

  return (
    <>
      <style>{`
        @keyframes participantShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div
        className="mx-auto"
        style={{ maxWidth: 720, padding: '32px 16px' }}
      >
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton height={220} />
            <Skeleton height={200} />
            <Skeleton height={160} />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchDashboard} />
        ) : isEmpty ? (
          <EmptyState onJoined={fetchDashboard} />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Section 1 — Active workshop hero */}
            {data?.active_workshop && (
              <ActiveWorkshopCard workshop={data.active_workshop} />
            )}

            {/* Section 2 — Session timeline */}
            {data?.active_workshop && data.active_workshop.sessions.length > 0 && (
              <SessionTimeline sessions={data.active_workshop.sessions} />
            )}

            {/* Section 3 — Workshop info / logistics */}
            {data?.active_workshop?.logistics && (
              <WorkshopInfoCard
                logistics={data.active_workshop.logistics}
                workshopId={data.active_workshop.workshop_id}
              />
            )}

            {/* Section 4 — Other workshops */}
            {(data?.other_workshops ?? []).length > 0 && (
              <OtherWorkshopsGrid
                workshops={data!.other_workshops}
                onJoined={fetchDashboard}
              />
            )}

            {/* Join CTA when no other workshops section */}
            {(data?.other_workshops ?? []).length === 0 && data?.active_workshop && (
              <OtherWorkshopsGrid workshops={[]} onJoined={fetchDashboard} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
