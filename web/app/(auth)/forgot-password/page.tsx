'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiPost } from '@/lib/api/client';
import { AuthCard } from '@/components/auth/AuthCard';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await apiPost('/auth/forgot-password', values);
    } catch {
      // always show success to prevent email enumeration
    } finally {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <AuthCard>
        <div className="text-center">
          <h2 className="font-heading text-xl font-semibold text-dark mb-3">Check your email</h2>
          <p className="text-sm text-medium-gray mb-6">
            If an account with that email exists, we sent a password reset link. Check your inbox.
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div>
        <h2 className="font-heading text-xl font-semibold text-dark mb-2">Reset your password</h2>
        <p className="text-sm text-medium-gray mb-6">
          Enter your email address and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/login" className="text-sm text-medium-gray hover:text-dark transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
