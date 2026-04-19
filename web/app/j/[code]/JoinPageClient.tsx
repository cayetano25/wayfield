'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface JoinWorkshop {
  id: number;
  title: string;
  workshop_type: 'session_based' | 'event_based';
  start_date: string | null;
  end_date: string | null;
  timezone: string;
  public_summary: string | null;
  description: string | null;
  social_share_image_url: string | null;
  default_location: { city: string | null; state_or_region: string | null } | null;
}

interface JoinUserState {
  is_authenticated: boolean;
  is_already_registered: boolean;
}

interface Props {
  code: string;
  isMobileSsr: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

function formatDateRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone,
  };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString('en-US', opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString('en-US', opts);
  return s === e ? s : `${s} – ${e}`;
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-20">
      <div className="w-20 h-20 rounded-full bg-coral/10 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-4xl text-coral">cancel</span>
      </div>
      <h1 className="font-heading text-2xl font-bold text-dark mb-3">Invalid Join Code</h1>
      <p className="text-medium-gray max-w-sm leading-relaxed">
        This join code is not valid or the workshop is no longer accepting registrations.
      </p>
      <p className="text-sm text-medium-gray mt-3">
        Contact your workshop organizer for a valid code.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16 space-y-4">
      <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
      <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
      <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
      <div className="h-16 bg-gray-100 rounded animate-pulse" />
      <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}

function AppStoreBadges({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className ?? ''}`}>
      <a
        href="https://apps.apple.com/app/wayfield/idYOUR_APP_STORE_ID"
        className="inline-flex items-center gap-2 bg-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-dark/80 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-symbols-outlined text-base">phone_iphone</span>
        App Store
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.wayfield.mobile"
        className="inline-flex items-center gap-2 bg-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-dark/80 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="material-symbols-outlined text-base">android</span>
        Google Play
      </a>
    </div>
  );
}

export default function JoinPageClient({ code, isMobileSsr }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [workshop, setWorkshop] = useState<JoinWorkshop | null>(null);
  const [userState, setUserState] = useState<JoinUserState | null>(null);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(isMobileSsr);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Refine mobile detection client-side
  useEffect(() => {
    setIsMobile(/android|iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  // Fetch join code data (client-side so Playwright page.route() mocks work)
  useEffect(() => {
    async function load() {
      try {
        const token = document.cookie.match(/wayfield_token=([^;]*)/)?.[1];
        const res = await fetch(`${BASE_URL}/join/${code}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
          },
        });
        const data = await res.json();
        setIsValid(data?.join_code?.is_valid === true);
        setWorkshop(data?.workshop ?? null);
        setUserState(data?.user_state ?? null);
      } catch {
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

  async function handleJoin() {
    if (!workshop) return;

    if (!userState?.is_authenticated) {
      sessionStorage.setItem('pendingJoin', `/j/${code}`);
      router.push(`/login?redirect=/j/${code}`);
      return;
    }

    setJoining(true);
    setJoinError(null);
    try {
      const token = document.cookie.match(/wayfield_token=([^;]*)/)?.[1];
      const res = await fetch(`${BASE_URL}/workshops/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
        },
        body: JSON.stringify({ join_code: code }),
      });

      if (res.ok) {
        router.push('/my-workshops?joined=1');
      } else {
        const data = await res.json().catch(() => ({}));
        setJoinError(data.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setJoinError('Unable to connect. Please check your connection and try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border-gray">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-extrabold text-[#006972] tracking-tight">
            Wayfield
          </Link>
          {!userState?.is_authenticated && (
            <Link href="/login" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        {loading ? (
          <LoadingState />
        ) : !isValid ? (
          <ErrorState />
        ) : workshop ? (
          <>
            {/* Mobile app banner */}
            {isMobile && !bannerDismissed && (
              <div className="bg-primary text-white w-full">
                <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
                  <p className="font-semibold text-sm">Get the Wayfield app for the best experience</p>
                  <AppStoreBadges />
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="text-xs text-white/70 hover:text-white text-left underline underline-offset-2 w-fit"
                  >
                    Continue in browser →
                  </button>
                </div>
              </div>
            )}

            {/* Workshop hero image */}
            {workshop.social_share_image_url ? (
              <div className="w-full h-52 sm:h-64 overflow-hidden">
                <img
                  src={workshop.social_share_image_url}
                  alt={workshop.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-full h-52 sm:h-64"
                style={{ background: 'linear-gradient(135deg, #006972 0%, #0FA3B1 100%)' }}
              />
            )}

            {/* Workshop details */}
            <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {workshop.workshop_type === 'session_based' ? 'Session-Based' : 'Event-Based'}
              </span>

              <h1 className="font-heading text-2xl font-bold text-dark leading-snug -mt-2">
                {workshop.title}
              </h1>

              {workshop.start_date && workshop.end_date && (
                <div className="flex items-center gap-2 text-medium-gray text-sm">
                  <span className="material-symbols-outlined text-base text-primary">calendar_today</span>
                  {formatDateRange(workshop.start_date, workshop.end_date, workshop.timezone)}
                </div>
              )}

              {(workshop.default_location?.city || workshop.default_location?.state_or_region) && (
                <div className="flex items-center gap-2 text-medium-gray text-sm">
                  <span className="material-symbols-outlined text-base text-primary">location_on</span>
                  {[workshop.default_location.city, workshop.default_location.state_or_region]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}

              {(workshop.public_summary || workshop.description) && (
                <p className="text-medium-gray leading-relaxed text-sm">
                  {workshop.public_summary ?? (workshop.description ?? '').slice(0, 200)}
                </p>
              )}

              {userState?.is_already_registered ? (
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
                  <span className="material-symbols-outlined text-2xl text-primary mb-1 block">check_circle</span>
                  <p className="font-semibold text-primary text-sm">You&apos;re already registered for this workshop.</p>
                  <Link
                    href="/my-workshops"
                    className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-2"
                  >
                    View my workshops →
                  </Link>
                </div>
              ) : (
                <>
                  {joinError && (
                    <p className="text-sm text-coral font-medium">{joinError}</p>
                  )}
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  >
                    {joining ? 'Joining…' : 'Join Workshop'}
                  </button>
                </>
              )}

              <div className="pt-4 border-t border-border-gray text-center space-y-3">
                <p className="text-xs text-medium-gray">Join faster with the Wayfield app</p>
                <div className="flex justify-center">
                  <AppStoreBadges />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>

      <footer className="border-t border-border-gray py-6 text-center text-xs text-medium-gray">
        © {new Date().getFullYear()} Wayfield. All rights reserved.
      </footer>
    </div>
  );
}
