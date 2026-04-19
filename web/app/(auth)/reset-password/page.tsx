'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, apiPost } from '@/lib/api/client';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthCard } from '@/components/auth/AuthCard';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Must be 10+ characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      await apiPost('/auth/reset-password', { ...values, token, email });
      toast.success('Password reset successfully. Please sign in.');
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <AuthCard>
      <div>
        <h2 className="font-heading text-xl font-semibold text-dark mb-2">Set new password</h2>
        <p className="text-sm text-medium-gray mb-6">Choose a strong password for your account.</p>

        {apiError && (
          <div className="mb-4 px-4 py-3 bg-danger/8 border border-danger/20 rounded-lg text-sm text-danger">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={errors.password?.message}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-light-gray hover:text-dark transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...register('password')}
          />

          <Input
            label="Confirm new password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={errors.password_confirmation?.message}
            {...register('password_confirmation')}
          />

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Reset password
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <ToastProvider />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
