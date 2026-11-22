import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/landing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
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

  // Admin routes: Kept on existing Django admin session authentication (NOT handled by Clerk)
  if (pathname.startsWith('/admin')) {
    const isAdminAuthPage =
      pathname === '/admin/login' ||
      pathname === '/admin/forgot-password' ||
      pathname === '/admin/reset-password';

    if (isAdminAuthPage) {
      return NextResponse.next();
    }

    const sessionCookie = request.cookies.get('sessionid') || request.cookies.get('auth_session');
    const userRole = request.cookies.get('user_role')?.value;
    const isAuthenticated = Boolean(sessionCookie?.value);

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Public student marketing / auth routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Protected student routes: Enforce Clerk login
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
