import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { extractRoleFromClaims } from './lib/rbac';

const isPublicRoute = createRouteMatcher([
  '/',
  '/landing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
  '/403',
  '/courses(.*)',
  '/courses(.*)',
  '/books(.*)',
  '/terms(.*)',
  '/privacy(.*)',
  '/refund(.*)',
  '/shipping(.*)',
  '/contact(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Next.js internals, API proxy routes, and static file requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Admin routes:
  if (pathname.startsWith('/admin')) {
    const isAdminAuthPage =
      pathname === '/admin/login' ||
      pathname === '/admin/forgot-password' ||
      pathname === '/admin/reset-password';

    if (isAdminAuthPage) {
      return NextResponse.next();
    }

    // Check Django session or Clerk session
    const sessionCookie = request.cookies.get('sessionid') || request.cookies.get('auth_session');
    const userRoleCookie = request.cookies.get('user_role')?.value;
    const isDjangoAuth = Boolean(sessionCookie?.value);

    const clerkAuth = await auth();
    const clerkRole = extractRoleFromClaims(clerkAuth.sessionClaims);
    const isClerkAdmin = Boolean(clerkAuth.userId && clerkRole === 'admin');

    // If signed in as student (in Clerk or cookie) and trying to access admin -> 403
    if (userRoleCookie === 'STUDENT' || (clerkAuth.userId && clerkRole === 'student')) {
      return NextResponse.redirect(new URL('/403', request.url));
    }

    if (!isDjangoAuth && !isClerkAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (userRoleCookie && userRoleCookie !== 'ADMIN' && !isClerkAdmin) {
      return NextResponse.redirect(new URL('/403', request.url));
    }

    return NextResponse.next();
  }

  // Teacher routes: Accessible by teacher and admin roles
  if (pathname.startsWith('/teacher')) {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    const role = extractRoleFromClaims(session.sessionClaims);
    if (role !== 'teacher' && role !== 'admin') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
    return NextResponse.next();
  }

  // Public student marketing / auth routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Protected student routes: Enforce Django session OR Clerk login
  const sessionCookie = request.cookies.get('sessionid')?.value;
  const authSessionCookie = request.cookies.get('auth_session')?.value;
  const userRoleCookie = request.cookies.get('user_role')?.value;
  const isDjangoAuth = Boolean(sessionCookie || authSessionCookie);

  // If authenticated via Django session as student or admin, allow through
  if (isDjangoAuth && (userRoleCookie === 'STUDENT' || userRoleCookie === 'ADMIN' || !userRoleCookie)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session.userId) {
    const signInUrl = new URL('/sign-in', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
