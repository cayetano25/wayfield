'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, KeyRound, Loader2, Lock } from 'lucide-react';
import { useAdminUser } from '@/contexts/AdminUserContext';
import {
  platformAuth,
  platformTwoFactor,
  setToken,
  getToken,
  type AdminUser,
} from '@/lib/platform-api';
import { TotpInput } from '@/components/ui/TotpInput';

// ─── Credentials screen ───────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

type LoginState = 'credentials' | 'totp' | 'recovery';

function Wordmark() {
  return (
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { setAdminUser } = useAdminUser();

  // State machine
  const [loginState, setLoginState] = useState<LoginState>('credentials');

  // 2FA session token — never stored in localStorage
  const sessionTokenRef = useRef<string | null>(null);

  // TOTP screen state
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  // Recovery screen state
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Credentials form
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (getToken()) router.replace('/');
  }, [router]);

  // Auto-submit TOTP when 6 digits are entered
  useEffect(() => {
    if (totpCode.length === 6 && loginState === 'totp' && !totpLoading) {
      const timer = setTimeout(() => submitTotp(totpCode), 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totpCode, loginState]);

  // ── Credentials submit ──────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    try {
      const { data } = await platformAuth.login(values.email, values.password);

      if (data.requires_2fa) {
        sessionTokenRef.current = data.two_factor_session_token;
        setLoginState('totp');
      } else {
        setToken(data.token);
        setAdminUser(data.admin_user);
        router.replace('/');
      }
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

  // ── TOTP submit ─────────────────────────────────────────────────────────────

  async function submitTotp(code: string) {
    const sessionToken = sessionTokenRef.current;
    if (!sessionToken || totpLoading) return;

    setTotpLoading(true);
    setTotpError(null);

    try {
      const { data } = await platformTwoFactor.verify(sessionToken, code);
      finishAuth(data.token, data.admin_user);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; attempts_remaining?: number }; status?: number } })?.response;
      const msg = res?.data?.message ?? 'Invalid code.';
      const remaining = res?.data?.attempts_remaining ?? null;

      setTotpCode('');

      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('log in again')) {
        sessionTokenRef.current = null;
        setLoginState('credentials');
        setError('root', { message: 'Your session expired. Please log in again.' });
      } else {
        setAttemptsRemaining(remaining);
        setTotpError(
          remaining !== null && remaining > 0
            ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : msg,
        );
      }
    } finally {
      setTotpLoading(false);
    }
  }

  // ── Recovery submit ─────────────────────────────────────────────────────────

  async function submitRecovery() {
    const sessionToken = sessionTokenRef.current;
    if (!sessionToken || recoveryLoading || !recoveryCode.trim()) return;

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const { data } = await platformTwoFactor.recovery(sessionToken, recoveryCode.trim());
      finishAuth(data.token, data.admin_user, data.recovery_codes_exhausted);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid recovery code.';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('log in again')) {
        sessionTokenRef.current = null;
        setLoginState('credentials');
        setError('root', { message: 'Your session expired. Please log in again.' });
      } else {
        setRecoveryError(msg);
      }
    } finally {
      setRecoveryLoading(false);
    }
  }

  function finishAuth(token: string, adminUser: AdminUser, codesExhausted?: boolean) {
    setToken(token);
    setAdminUser(adminUser);
    sessionTokenRef.current = null;
    // If recovery codes exhausted, we'd ideally show a toast after redirect.
    // Store a flag in sessionStorage (not localStorage) so the settings page can pick it up.
    if (codesExhausted) {
      sessionStorage.setItem('cc_recovery_codes_exhausted', '1');
    }
    router.replace('/');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loginState === 'totp') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#111827] px-4">
        <Wordmark />

        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-8 py-10">
          {/* Back button */}
          <button
            onClick={() => {
              sessionTokenRef.current = null;
              setTotpCode('');
              setTotpError(null);
              setAttemptsRemaining(null);
              setLoginState('credentials');
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 min-h-[44px] -ml-1 transition-colors"
          >
            ← Back
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <Lock size={32} className="text-[#0FA3B1]" />
          </div>

          {/* Heading */}
          <h1
            className="text-[22px] font-semibold text-gray-900 mb-1 text-center"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Two-factor verification
          </h1>
          <p
            className="text-sm text-gray-500 mb-6 text-center"
            style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
          >
            Enter the 6-digit code from your authenticator app.
          </p>

          {/* TOTP input */}
          <div className="flex justify-center">
            <TotpInput
              value={totpCode}
              onChange={setTotpCode}
              disabled={totpLoading}
            />
          </div>

          {/* Error area */}
          <div className="mt-3 min-h-[20px]">
            {totpError && (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{totpError}</span>
              </div>
            )}
          </div>

          {/* Verify button */}
          <button
            type="button"
            disabled={totpCode.length !== 6 || totpLoading}
            onClick={() => submitTotp(totpCode)}
            className="mt-4 w-full h-[44px] rounded-lg bg-[#0FA3B1] text-white text-sm font-medium hover:bg-[#0d8f9c] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA3B1] transition-colors flex items-center justify-center gap-2"
          >
            {totpLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify'
            )}
          </button>

          {/* Recovery code link */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setTotpError(null);
                setLoginState('recovery');
              }}
              className="text-sm text-[#0FA3B1] hover:underline min-h-[44px] flex items-center transition-colors"
            >
              Use a recovery code instead →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loginState === 'recovery') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#111827] px-4">
        <Wordmark />

        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-8 py-10">
          {/* Back button */}
          <button
            onClick={() => {
              setRecoveryCode('');
              setRecoveryError(null);
              setLoginState('totp');
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 min-h-[44px] -ml-1 transition-colors"
          >
            ← Back
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <KeyRound size={32} className="text-amber-500" />
          </div>

          {/* Heading */}
          <h1
            className="text-[22px] font-semibold text-gray-900 mb-1 text-center"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Use recovery code
          </h1>
          <p
            className="text-sm text-gray-500 mb-6 text-center"
            style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
          >
            Enter one of your 8-character recovery codes.
          </p>

          {/* Recovery code input */}
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
            placeholder="XXXXX-XXXXX"
            className="w-full h-[44px] border-2 border-gray-200 rounded-xl px-4 text-center font-mono text-lg tracking-widest uppercase focus:border-[#0FA3B1] focus:outline-none focus:ring-0 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Error area */}
          <div className="mt-3 min-h-[20px]">
            {recoveryError && (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{recoveryError}</span>
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="button"
            disabled={!recoveryCode.trim() || recoveryLoading}
            onClick={submitRecovery}
            className="mt-4 w-full h-[44px] rounded-lg bg-[#E67E22] text-white text-sm font-medium hover:bg-[#d06a1b] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E67E22] transition-colors flex items-center justify-center gap-2"
          >
            {recoveryLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify recovery code'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Each recovery code can only be used once.
          </p>
        </div>
      </div>
    );
  }

  // ── Credentials screen (default) ───────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111827] px-4">
      <Wordmark />

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
