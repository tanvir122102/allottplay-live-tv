import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { releaseDevice } from '@/lib/access-links';

const ACCESS_COOKIE = 'live_tv_access_grant';
const DEVICE_COOKIE = 'live_tv_device_id';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.match(new RegExp(`${ACCESS_COOKIE}=([^;]+)`))?.[1];
  const deviceId = cookieHeader.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`))?.[1];

  if (token && deviceId) {
    const link = await db.accessLink.findUnique({ where: { token } });
    if (link) await releaseDevice(link.id, deviceId);
  }

  return NextResponse.json({ ok: true });
}