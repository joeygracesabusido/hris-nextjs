import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/register', '/forgot-password', '/auth/sync', '/api/login', '/api/register'];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // NextAuth endpoints (signin / callback / session) must stay public,
  // otherwise the Google OAuth flow gets redirected to /login mid-flight
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/users') || 
      pathname.startsWith('/api/employees') || 
      pathname.startsWith('/api/time-logs') || 
      pathname.startsWith('/api/leaves') || 
      pathname.startsWith('/api/payroll') || 
      pathname.startsWith('/api/overtime') ||
      pathname.startsWith('/api/shifts') ||
      pathname.startsWith('/api/schedules') ||
      pathname.startsWith('/api/dashboard') ||
      pathname.startsWith('/api/advances')) {
    return NextResponse.next();
  }

  if (!isLoggedIn && pathname !== '/login' && pathname !== '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
