import { NextResponse } from 'next/server';
import { verifyAndConsumeToken, generateDeviceId, tryRegisterDevice } from '@/lib/access-links';

const ACCESS_COOKIE = 'live_tv_access_grant';
const DEVICE_COOKIE = 'live_tv_device_id';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await verifyAndConsumeToken(token);
  const url = new URL(req.url);

  if (!link) {
    return NextResponse.redirect(new URL('/access-denied', url.origin));
  }

  let deviceId = req.headers.get('cookie')?.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`))?.[1];
  if (!deviceId) deviceId = generateDeviceId();

  const slotResult = await tryRegisterDevice(link.id, deviceId, link.maxDevices);

  if (slotResult === 'limit') {
    const denied = NextResponse.redirect(new URL(`/access-denied?reason=limit&token=${encodeURIComponent(token)}`, url.origin));
    denied.cookies.set({ name: DEVICE_COOKIE, value: deviceId, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return denied;
  }

  const response = NextResponse.redirect(new URL('/', url.origin));
  const maxAgeSeconds = Math.max(1, Math.floor((link.expiresAt.getTime() - Date.now()) / 1000));

  response.cookies.set({
    name: ACCESS_COOKIE,
    value: link.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
  response.cookies.set({
    name: DEVICE_COOKIE,
    value: deviceId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });

  return response;
}