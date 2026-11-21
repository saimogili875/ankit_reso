import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/landing',
  '/login',
  '/register',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/payment-test',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Next internals, API routes, and static file requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Handle /admin/login alias redirect to unified login page
  if (pathname === '/admin/login') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('role', 'admin');
    return NextResponse.redirect(loginUrl);
  }

  // Check if current route is a public route
  const isPublicRoute = PUBLIC_PATHS.some((path) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
  );

  // Read session indicators from cookies
  const sessionCookie = request.cookies.get('sessionid') || request.cookies.get('auth_session');
  const userRole = request.cookies.get('user_role')?.value;
  const isAuthenticated = Boolean(sessionCookie?.value);

  // Note on Architecture & Cookie Writers:
  // In our split-domain deployment (Next.js on Vercel/Render, Django API on Render),
  // cookies written by the backend API domain are not visible to Next.js middleware.
  // The frontend helper (setAuthCookies / clearAuthCookies) is the sole authoritative writer
  // for auth_session and user_role cookies on the frontend origin.
  // We explicitly do NOT redirect authenticated users away from /login or /register inside
  // middleware based on cookies alone: stale client cookies would cause an infinite redirect
  // loop if the backend session had expired. Instead, login/page.tsx inspects live /auth/me/
  // state via useAuth() before performing client-side navigation.

  // 1. Unauthenticated users trying to access protected routes redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    if (pathname.startsWith('/admin')) {
      loginUrl.searchParams.set('role', 'admin');
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Admin routes require ADMIN role (UX-level guard; backend IsAdminRole enforces security)
  if (pathname.startsWith('/admin')) {
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

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
