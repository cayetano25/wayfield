import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/workshops',
  '/organization',
  '/reports',
  '/onboarding',
  '/profile',
  '/my-workshops',
  '/leader',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const tokenCookie = req.cookies.get('wayfield_token');
  const userCookie = req.cookies.get('wayfield_user');

  const hasToken = !!tokenCookie?.value;

  let user: { onboarding_intent?: string | null; onboarding_completed_at?: string | null } | null = null;
  if (userCookie?.value) {
    try {
      user = JSON.parse(decodeURIComponent(userCookie.value));
    } catch {
      // ignore malformed cookie
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isOnboarding = pathname.startsWith('/onboarding');
  const isAuthRoute = pathname === '/login' || pathname === '/register';

  // Unauthenticated user hitting a protected route → login
  if (isProtected && !hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user on auth routes → dashboard
  if (isAuthRoute && hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (hasToken && user) {
    const onboardingComplete = !!user.onboarding_completed_at;

    // Authenticated user with incomplete onboarding → redirect to wizard.
    // Only redirect if onboarding_intent is explicitly set: users who have no
    // intent predate the onboarding system and must never be sent to /onboarding.
    if (user.onboarding_intent != null && !onboardingComplete && isProtected && !isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Authenticated user who already finished onboarding hitting /onboarding → dashboard
    if (onboardingComplete && isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/workshops/:path*',
    '/organization/:path*',
    '/reports/:path*',
    '/onboarding/:path*',
    '/profile/:path*',
    '/my-workshops/:path*',
    '/leader/:path*',
    '/login',
    '/register',
  ],
};
