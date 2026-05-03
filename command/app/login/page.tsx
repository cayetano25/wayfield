'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (getToken()) router.replace('/');
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
      router.replace('/');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 422) {
        setError('root', { message: 'Invalid email or password.' });
      } else if (status === 403) {
        setError('root', { message: 'Your account is inactive. Contact a super admin.' });
      } else {
        setError('root', { message: 'Connection error. Please check your network.' });
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111827] px-4">
      {/* Wordmark above card */}
      <div className="mb-8 text-center">
        <p
          className="text-lg font-bold text-white mb-1"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          WAYFIELD
        </p>
        <p
          className="text-[11px] uppercase tracking-widest text-gray-400"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          Command Center
        </p>
      </div>

      {/* White card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-8 py-10">
        <h1
          className="text-2xl font-semibold text-gray-900 mb-1"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          Sign in
        </h1>
        <p
          className="text-sm text-gray-500 mb-6"
          style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
        >
          Platform administrator access only
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-[13px] font-medium text-gray-700 mb-1"
              style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full h-[44px] border border-gray-200 rounded-lg px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
              placeholder="admin@wayfield.io"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="mt-4">
            <label
              htmlFor="password"
              className="block text-[13px] font-medium text-gray-700 mb-1"
              style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full h-[44px] border border-gray-200 rounded-lg px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Error area */}
          <div className="mt-3 min-h-[20px]">
            {errors.root && (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{errors.root.message}</span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full h-[44px] rounded-lg bg-[#0FA3B1] text-white text-sm font-medium hover:bg-[#0d8f9c] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA3B1] transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
