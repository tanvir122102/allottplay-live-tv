import crypto from 'node:crypto';
import { db } from './prisma';

const STALE_MS = 45_000; // ৪৫ সেকেন্ড heartbeat না পেলে device inactive ধরা হবে

export function generateToken() {
  const digits = Math.random() < 0.5 ? 8 : 10;
  const max = 10 ** digits;
  const min = 10 ** (digits - 1);

  // crypto.randomInt gives cryptographically secure, unbiased integer selection.
  const number = crypto.randomInt(min, max);
  return `allottplay${number}`;
}

export function generateDeviceId() {
  return crypto.randomBytes(16).toString('base64url');
}

export async function createAccessLink(expiresAt: Date, label?: string, maxDevices?: number | null) {
  // Retry on the extremely unlikely event of a token collision.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = generateToken();

    try {
      return await db.accessLink.create({
        data: { token, expiresAt, label: label || null, maxDevices: maxDevices ?? null },
      });
    } catch (error) {
      const isUniqueViolation =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002';

      if (!isUniqueViolation || attempt === 9) throw error;
    }
  }

  throw new Error('Failed to generate a unique access token');
}

export async function listAccessLinks() {
  const links = await db.accessLink.findMany({ orderBy: { createdAt: 'desc' } });
  const cutoff = new Date(Date.now() - STALE_MS);
  const counts = await db.accessDeviceSession.groupBy({
    by: ['accessLinkId'],
    where: { lastSeenAt: { gte: cutoff } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.accessLinkId, c._count._all]));
  return links.map((l) => ({ ...l, activeDevices: countMap.get(l.id) || 0 }));
}

export async function revokeAccessLink(id: string) {
  return db.accessLink.update({ where: { id }, data: { revoked: true } });
}

export async function deleteAccessLink(id: string) {
  return db.accessLink.delete({ where: { id } });
}

export async function verifyAndConsumeToken(token: string) {
  const link = await db.accessLink.findUnique({ where: { token } });
  if (!link) return null;
  if (link.revoked) return null;
  if (link.expiresAt.getTime() <= Date.now()) return null;

  await db.accessLink.update({
    where: { id: link.id },
    data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
  });

  return link;
}

// দুইটা সম্ভাব্য ফলাফল: 'ok' (slot দেওয়া হয়েছে) অথবা 'limit' (slot নেই)
export async function tryRegisterDevice(accessLinkId: string, deviceId: string, maxDevices: number | null) {
  const cutoff = new Date(Date.now() - STALE_MS);

  const existing = await db.accessDeviceSession.findUnique({
    where: { accessLinkId_deviceId: { accessLinkId, deviceId } },
  });
  if (existing) {
    await db.accessDeviceSession.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
    return 'ok' as const;
  }

  if (maxDevices == null) {
    await db.accessDeviceSession.create({ data: { accessLinkId, deviceId } });
    return 'ok' as const;
  }

  const activeCount = await db.accessDeviceSession.count({
    where: { accessLinkId, lastSeenAt: { gte: cutoff } },
  });

  if (activeCount >= maxDevices) return 'limit' as const;

  await db.accessDeviceSession.create({ data: { accessLinkId, deviceId } });
  return 'ok' as const;
}

export async function releaseDevice(accessLinkId: string, deviceId: string) {
  try {
    await db.accessDeviceSession.delete({
      where: { accessLinkId_deviceId: { accessLinkId, deviceId } },
    });
  } catch {
    // already gone, ignore
  }
}