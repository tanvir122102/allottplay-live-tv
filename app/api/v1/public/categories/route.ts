import { NextResponse } from 'next/server';

function jsonCached(data: unknown) { return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }); }
import { db } from '@/lib/prisma';

export async function GET() {
  const rows = await db.channel.findMany({where:{healthStatus:'ACTIVE'},select:{groupTitle:true}});
  const counts = new Map<string,number>();
  for (const row of rows) {
    const name = row.groupTitle?.trim() || 'Other';
    counts.set(name,(counts.get(name) || 0)+1);
  }
  return jsonCached([...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,count])=>({name,count})));
}
