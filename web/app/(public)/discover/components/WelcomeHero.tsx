'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiPost } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { AdminUser } from '@/lib/auth/session';

/* ─── Join workshop modal ─────────────────────────────────────────────── */

function JoinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleJoin} loading={joining} disabled={!code.trim()}>Join</Button>
        </>
      }
    >
      <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6B7280' }}>
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

/* ─── Invitation modal ────────────────────────────────────────────────── */

function InvitationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken] = useState('');
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    const trimmed = token.trim();
    if (!trimmed) return;
    setAccepting(true);
    try {
      await apiPost(`/leader/invitations/${trimmed}/accept`, {});
      toast.success('Invitation accepted! You can now access your sessions.');
      setToken('');
      onClose();
    } catch {
      toast.error('Invalid invitation token. Please check your invitation email.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accept an Invitation"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAccept} loading={accepting} disabled={!token.trim()}>
            Accept Invitation
          </Button>
        </>
      }
    >
      <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6B7280' }}>
        Paste the invitation token from your leader invitation email.
      </p>
      <Input
        label="Invitation Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste your token here"
        onKeyDown={(e) => { if (e.key === 'Enter') void handleAccept(); }}
      />
    </Modal>
  );
}

/* ─── Action card ─────────────────────────────────────────────────────── */

function ActionCard({
  icon,
  title,
  sub,
  onClick,
  href,
}: {
  icon: string;
  title: string;
  sub: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <div
      className="bg-white flex flex-col gap-2 transition-all duration-150"
      style={{
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        minWidth: 160,
        flex: '1 1 0',
        cursor: onClick || href ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <p className="font-heading font-bold" style={{ fontSize: 14, color: '#2E2E2E' }}>
        {title}
      </p>
      <p className="font-sans" style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
        {sub}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href} className="no-underline">{content}</Link>;
  }

  return <button type="button" onClick={onClick} className="text-left">{content}</button>;
}

/* ─── WelcomeHero ─────────────────────────────────────────────────────── */

interface WelcomeHeroProps {
  user: AdminUser;
  onboardingComplete: boolean;
}

export function WelcomeHero({ user, onboardingComplete }: WelcomeHeroProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)',
          padding: '48px 64px',
        }}
      >
        <div
          className="mx-auto flex items-center justify-between gap-12"
          style={{ maxWidth: 1200 }}
        >
          {/* Left column */}
          <div className="flex flex-col" style={{ maxWidth: 400 }}>
            <h1 className="font-heading font-bold text-white" style={{ fontSize: 32, lineHeight: 1.2 }}>
              Welcome to Wayfield, {user.first_name}
            </h1>
            <span style={{ fontSize: 32, marginTop: 4 }}>👋</span>
            <p
              className="font-sans mt-4"
              style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65 }}
            >
              You&apos;re all set. Here&apos;s what you can do to start your creative journey today:
            </p>
            {!onboardingComplete && (
              <Link
                href="/onboarding"
                className="font-sans font-semibold rounded-lg transition-colors hover:opacity-90 mt-5 inline-block"
                style={{
                  fontSize: 14,
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#0FA3B1',
                  alignSelf: 'flex-start',
                }}
              >
                Complete Setup →
              </Link>
            )}
          </div>

          {/* Right column — action cards */}
          <div className="flex gap-4 flex-1" style={{ maxWidth: 520 }}>
            <ActionCard
              icon="🎯"
              title="Join a Workshop"
              sub="Enter a code to join an existing workshop."
              onClick={() => setJoinOpen(true)}
            />
            <ActionCard
              icon="🏢"
              title="Run Workshops"
              sub="Create your organization and lead teams."
              href="/onboarding"
            />
            <ActionCard
              icon="🎓"
              title="Accept Invitation"
              sub="Redeem an invite from your mentor."
              onClick={() => setInviteOpen(true)}
            />
          </div>
        </div>
      </div>

      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      <InvitationModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}
