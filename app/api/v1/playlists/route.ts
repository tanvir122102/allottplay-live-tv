import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { parseM3U } from '@/lib/m3u-parser';
import { safeFetch } from '@/lib/safe-remote-url';
import { runHealthChecksUntilDone } from '@/lib/health-runner';

const schema = z.object({ name: z.string().min(1).max(120), m3uUrl: z.string().url(), logoUrl: z.string().url().optional().or(z.literal('')) });

export async function GET() {
  const denied = await adminGuard(); if (denied) return denied;
  const playlists = await db.playlist.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { channels: true } } } });
  return NextResponse.json(playlists);
}

export async function POST(req: Request) {
  const denied = await adminGuard(); if (denied) return denied;
  try {
    const body = schema.parse(await req.json());
    const res = await safeFetch(body.m3uUrl, { cache: 'no-store', timeoutMs: 20000 });
    if (!res.ok) return NextResponse.json({ error: `M3U fetch failed: ${res.status}` }, { status: 400 });

    const rawParsed = parseM3U(await res.text());
    const seenKeys = new Set<string>();
    const parsed = rawParsed.filter((ch) => {
      if (seenKeys.has(ch.sourceKey)) return false;
      seenKeys.add(ch.sourceKey);
      return true;
    });

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No channels found in this playlist' }, { status: 400 });
    }

    const playlist = await db.playlist.create({ data: { name: body.name, m3uUrl: body.m3uUrl, logoUrl: body.logoUrl || null, channels: { create: parsed } } });

    runHealthChecksUntilDone().catch((err) => console.error('Auto health check failed:', err));

    return NextResponse.json({ ...playlist, channelCount: parsed.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}