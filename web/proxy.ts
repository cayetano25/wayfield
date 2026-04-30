import { NextRequest, NextResponse } from 'next/server';
import { getPostLoginRedirect, type UserWithContexts } from '@/lib/utils/routing';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/organization',
  '/reports',
  '/onboarding',
  '/profile',
  '/leader',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const tokenCookie = req.cookies.get('wayfield_token');
  const userCookie = req.cookies.get('wayfield_user');

  const hasToken = !!tokenCookie?.value;

  let user: UserWithContexts | null = null;
  if (userCookie?.value) {
    try {
      user = JSON.parse(decodeURIComponent(userCookie.value)) as UserWithContexts;
    } catch {
      // ignore malformed cookie
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isOnboarding = pathname.startsWith('/onboarding');
  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isVerifyEmail = pathname === '/verify-email';

  // Unauthenticated user hitting a protected route → login
  if (isProtected && !hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user on auth routes → role-aware home (respects email verification).
  // Exception: if the redirect destination is /verify-email, let the user through to
  // /login so they can sign out or use a different account rather than being stuck.
  if (isAuthRoute && hasToken) {
    const destination = user ? getPostLoginRedirect(user) : '/workshops';
    if (destination !== '/verify-email') {
      const url = req.nextUrl.clone();
      url.pathname = destination;
      return NextResponse.redirect(url);
    }
  }

  if (hasToken && user) {
    const emailVerified = user.email_verified;
    const onboardingComplete = !!user.onboarding_completed_at;

    // Authenticated user with unverified email hitting any protected route → verify-email
    if (!emailVerified && isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = '/verify-email';
      return NextResponse.redirect(url);
    }

    // Verified user landing on verify-email page → role-aware home
    if (emailVerified && isVerifyEmail) {
      const url = req.nextUrl.clone();
      url.pathname = getPostLoginRedirect(user);
      return NextResponse.redirect(url);
    }

    // Authenticated user with incomplete onboarding → redirect to wizard.
    // Only redirect if onboarding_intent is explicitly set: users who have no
    // intent predate the onboarding system and must never be sent to /onboarding.
    if (emailVerified && user.onboarding_intent != null && !onboardingComplete && isProtected && !isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Authenticated user who already finished onboarding hitting /onboarding → role-aware home
    if (onboardingComplete && isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = getPostLoginRedirect(user);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/organization/:path*',
    '/reports/:path*',
    '/onboarding/:path*',
    '/profile/:path*',
    '/leader/:path*',
    '/login',
    '/register',
    '/verify-email',
  ],
};
