import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { parseM3U } from '@/lib/m3u-parser';
import { safeFetch } from '@/lib/safe-remote-url';

const schema = z.object({name:z.string().min(1).max(120),m3uUrl:z.string().url(),logoUrl:z.string().url().optional().or(z.literal(''))});

export async function GET(_: Request, {params}:{params:Promise<{id:string}>}) {
  const denied = await adminGuard(); if (denied) return denied;
  const {id}=await params;
  const item=await db.playlist.findUnique({where:{id},include:{_count:{select:{channels:true}}}});
  return item ? NextResponse.json(item) : NextResponse.json({error:'Not found'},{status:404});
}

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}) {
  const denied = await adminGuard(); if (denied) return denied;
  const {id}=await params; const body=schema.parse(await req.json());
  const res=await safeFetch(body.m3uUrl,{cache:'no-store',timeoutMs:20000});
  if(!res.ok) return NextResponse.json({error:`M3U fetch failed: ${res.status}`},{status:400});

  const rawParsed = parseM3U(await res.text());
  const seenKeys = new Set<string>();
  const parsed = rawParsed.filter((ch) => {
    if (seenKeys.has(ch.sourceKey)) return false;
    seenKeys.add(ch.sourceKey);
    return true;
  });

  const updated=await db.$transaction(async tx=>{
    const existing=await tx.channel.findMany({where:{playlistId:id}});
    const existingByKey=new Map(existing.map(c=>[c.sourceKey,c]));
    const seen=new Set<string>();
    for(const ch of parsed){
      seen.add(ch.sourceKey);
      const old=existingByKey.get(ch.sourceKey);
      if(old){
        await tx.channel.update({where:{id:old.id},data:{name:ch.name,streamUrl:ch.streamUrl,logoUrl:ch.logoUrl||null,groupTitle:ch.groupTitle||null,tvgId:ch.tvgId||null,tvgName:ch.tvgName||null}});
      }else{
        await tx.channel.create({data:{playlistId:id,...ch}});
      }
    }
    const stale=existing.filter(c=>!seen.has(c.sourceKey)).map(c=>c.id);
    if(stale.length) await tx.channel.deleteMany({where:{id:{in:stale}}});
    return tx.playlist.update({where:{id},data:{name:body.name,m3uUrl:body.m3uUrl,logoUrl:body.logoUrl||null}});
  });
  return NextResponse.json({...updated,channelCount:parsed.length});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}) {
  const denied = await adminGuard(); if (denied) return denied;
  const {id}=await params; await db.playlist.delete({where:{id}}); return new NextResponse(null,{status:204});
}