import { NextResponse } from 'next/server';

function jsonCached(data: unknown) { return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' } }); }
import { db } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const groupTitle = url.searchParams.get('category');
  const q = url.searchParams.get('q')?.trim();
  const where: any = {healthStatus:'ACTIVE'};
  if (groupTitle) where.groupTitle = groupTitle;
  if (q) where.OR = [{name:{contains:q,mode:'insensitive'}},{tvgName:{contains:q,mode:'insensitive'}},{tvgId:{contains:q,mode:'insensitive'}}];
  const channels = await db.channel.findMany({where,orderBy:{name:'asc'},select:{id:true,name:true,logoUrl:true,groupTitle:true,tvgId:true,tvgName:true,streamUrl:true,streamUrlOverride:true,playlistId:true,playlist:{select:{id:true,name:true,logoUrl:true}}}});
  return jsonCached(channels.map(c=>({...c,streamUrl:c.streamUrlOverride || c.streamUrl,streamUrlOverride:undefined})));
}
