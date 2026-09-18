import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { db } from '@/lib/prisma';

export async function GET(req: Request) {
  const denied = await adminGuard(); if (denied) return denied;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const playlistId = url.searchParams.get('playlistId');
  const q = url.searchParams.get('q')?.trim();
  const where: any = {};
  if (status === 'ACTIVE' || status === 'INACTIVE' || status === 'CHECKING' || status === 'UNKNOWN') where.healthStatus = status;
  if (playlistId) where.playlistId = playlistId;
  if (q) where.OR = [{name:{contains:q,mode:'insensitive'}},{tvgName:{contains:q,mode:'insensitive'}},{tvgId:{contains:q,mode:'insensitive'}}];

  const channels = await db.channel.findMany({where, orderBy:{name:'asc'}, include:{playlist:{select:{id:true,name:true}}}});
  return NextResponse.json(channels);
}
