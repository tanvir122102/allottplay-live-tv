export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { db } from '@/lib/prisma';

const ACCESS_COOKIE = 'live_tv_access_grant';

const EXEMPT_PREFIXES = [
  '/access/',
  '/access-denied',
  '/admin',
  '/api/v1/admin',
  '/api/v1/playlists',
  '/api/v1/channels',
  '/api/v1/health',
];

function isExempt(pathname: string) {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

async function isTokenStillValid(token: string) {
  try {
    const link = await db.accessLink.findUnique({ where: { token } });
    if (!link) return false;
    if (link.revoked) return false;
    if (link.expiresAt.getTime() <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/v1/public/')) {
    const rl = rateLimit(clientKey(req, 'public-api'), 120, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter), 'Cache-Control': 'no-store' } });
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 2_000_000) return NextResponse.json({ error: 'Request body too large' }, { status: 413 });

  if (origin && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && pathname.startsWith('/api/')) {
    try {
      if (origin !== req.nextUrl.origin) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    } catch {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
  }

  if (!isExempt(pathname)) {
    const cookieToken = req.cookies.get(ACCESS_COOKIE)?.value;
    const valid = cookieToken ? await isTokenStillValid(cookieToken) : false;
    if (!valid) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Access link required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.redirect(new URL('/access-denied', req.nextUrl.origin));
    }
  }

  const res = NextResponse.next();
  const isDev = process.env.NODE_ENV !== 'production';
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('X-Powered-By', 'ALL OTT PLAY');
  if (!isDev) res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (pathname.startsWith('/api/v1/admin') || pathname.startsWith('/api/v1/playlists') || pathname.startsWith('/api/v1/channels')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };