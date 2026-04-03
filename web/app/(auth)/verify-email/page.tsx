'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/api/client';

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      await apiPost('/auth/resend-verification');
      setResent(true);
    } catch {
      // ignore — show success anyway to avoid enumeration
      setResent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
      </div>

      <h2 className="font-heading text-xl font-semibold text-dark mb-3">Check your email</h2>
      <p className="text-sm text-medium-gray mb-8">
        We sent a verification link to your email address.
        Click the link to verify your account and get started.
      </p>

      {resent ? (
        <p className="text-sm text-primary font-medium mb-4">
          Verification email resent. Check your inbox.
        </p>
      ) : (
        <Button
          variant="secondary"
          size="md"
          className="w-full mb-4"
          loading={loading}
          onClick={handleResend}
        >
          Resend verification email
        </Button>
      )}

      <Link
        href="/login"
        className="text-sm text-medium-gray hover:text-dark transition-colors"
      >
        Back to sign in
      </Link>
    </div>
  );
}
