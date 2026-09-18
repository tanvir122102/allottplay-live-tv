import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { db } from '@/lib/prisma';

export async function GET() {
  const denied = await adminGuard(); if (denied) return denied;
  const [playlists,total,active,inactive,checking,unknown] = await Promise.all([
    db.playlist.count(),
    db.channel.count(),
    db.channel.count({where:{healthStatus:'ACTIVE'}}),
    db.channel.count({where:{healthStatus:'INACTIVE'}}),
    db.channel.count({where:{healthStatus:'CHECKING'}}),
    db.channel.count({where:{healthStatus:'UNKNOWN'}}),
  ]);
  return NextResponse.json({playlists,totalChannels:total,activeChannels:active,inactiveChannels:inactive,checkingChannels:checking,unknownChannels:unknown});
}
