'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAdminUser } from '@/contexts/AdminUserContext';
import { platformAuth, setToken, getToken } from '@/lib/platform-api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAdminUser } = useAdminUser();

  // Redirect already-authenticated admins
  useEffect(() => {
    if (getToken()) router.replace('/overview');
  }, [router]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const { data } = await platformAuth.login(values.email, values.password);
      setToken(data.token);
      setAdminUser(data.admin_user);
      router.replace('/overview');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 422) {
        setError('root', { message: 'Invalid email or password.' });
      } else if (status === 403) {
        setError('root', { message: 'Your account is inactive. Contact a super admin.' });
      } else {
        toast.error('Unable to connect to the platform API.');
      }
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-gray-900 px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <p className="font-heading text-2xl font-semibold text-white tracking-tight">
            Wayfield
          </p>
          <p className="mt-1 text-sm text-gray-400">Command Center</p>
        </div>

        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 shadow-xl">
          <h1 className="font-heading text-lg font-semibold text-white mb-6">
            Sign in to your account
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full h-11 rounded-lg bg-gray-900 border border-gray-600 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                placeholder="admin@wayfield.io"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full h-11 rounded-lg bg-gray-900 border border-gray-600 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3">
                <p className="text-sm text-red-300">{errors.root.message}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Wayfield platform access is restricted to authorised staff.
        </p>
      </div>
    </div>
  );
}
