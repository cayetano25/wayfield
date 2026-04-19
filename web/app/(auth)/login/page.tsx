'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, apiPost } from '@/lib/api/client';
import { setStoredUser, setToken, type AdminUser } from '@/lib/auth/session';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

interface LoginResponse {
  token: string;
  user: AdminUser;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const res = await apiPost<LoginResponse>('/auth/login', {
        ...values,
        platform: 'web',
      });
      setToken(res.token);
      setStoredUser(res.user);
      const pendingJoin = sessionStorage.getItem('pendingJoin');
      if (pendingJoin) {
        sessionStorage.removeItem('pendingJoin');
        router.push(pendingJoin);
        return;
      }
      const redirect = searchParams.get('redirect');
      if (redirect?.startsWith('/')) {
        router.push(redirect);
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-dark mb-6">Sign in to your account</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message ?? apiError ?? undefined}
          {...register('email')}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
