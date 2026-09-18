import { NextResponse } from 'next/server';

function jsonCached(data: unknown) { return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }); }
import { db } from '@/lib/prisma';

export async function GET() {
  const playlists = await db.playlist.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      _count: { select: { channels: { where: { healthStatus: 'ACTIVE' } } } },
    },
  });
  return jsonCached(playlists.map(p => ({
    id: p.id,
    name: p.name,
    logoUrl: p.logoUrl,
    activeChannelCount: p._count.channels,
  })));
}
