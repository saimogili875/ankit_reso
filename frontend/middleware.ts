import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/landing',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
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

  // 1. Unauthenticated users trying to access protected routes redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    if (pathname.startsWith('/admin')) {
      loginUrl.searchParams.set('role', 'admin');
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated users visiting /login or /register redirect to their appropriate home
  if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
    if (userRole === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Admin routes require ADMIN role. A student attempting to open /admin/* goes to /
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
