import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { db } from '@/lib/prisma';
import { parseM3U } from '@/lib/m3u-parser';
import { runHealthChecksUntilDone } from '@/lib/health-runner';

export async function POST(req: Request) {
  const denied = await adminGuard(); if (denied) return denied;
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const name = formData.get('name');
    const logoUrl = formData.get('logoUrl');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 });
    }
    if (file.size > 15_000_000) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.m3u') && !file.name.toLowerCase().endsWith('.m3u8')) {
      return NextResponse.json({ error: 'Only .m3u or .m3u8 files are supported' }, { status: 400 });
    }

    const text = await file.text();
    const rawParsed = parseM3U(text);
    if (rawParsed.length === 0) {
      return NextResponse.json({ error: 'No channels found in this file' }, { status: 400 });
    }

    const seen = new Set<string>();
    const parsed = rawParsed.filter((ch) => {
      if (seen.has(ch.sourceKey)) return false;
      seen.add(ch.sourceKey);
      return true;
    });

    const playlist = await db.playlist.create({
      data: {
        name: name.trim(),
        m3uUrl: `local-upload://${file.name}`,
        logoUrl: typeof logoUrl === 'string' && logoUrl ? logoUrl : null,
        channels: { create: parsed },
      },
    });

    runHealthChecksUntilDone().catch((err) => console.error('Auto health check failed:', err));

    return NextResponse.json({ ...playlist, channelCount: parsed.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}