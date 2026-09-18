import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { tryRegisterDevice } from '@/lib/access-links';

const ACCESS_COOKIE = 'live_tv_access_grant';
const DEVICE_COOKIE = 'live_tv_device_id';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.match(new RegExp(`${ACCESS_COOKIE}=([^;]+)`))?.[1];
  const deviceId = cookieHeader.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`))?.[1];

  if (!token || !deviceId) return NextResponse.json({ ok: false }, { status: 400 });

  const link = await db.accessLink.findUnique({ where: { token } });
  if (!link || link.revoked || link.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, reason: 'expired' }, { status: 403 });
  }

  const result = await tryRegisterDevice(link.id, deviceId, link.maxDevices);
  if (result === 'limit') {
    return NextResponse.json({ ok: false, reason: 'limit' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}