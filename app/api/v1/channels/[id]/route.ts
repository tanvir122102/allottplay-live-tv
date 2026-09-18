import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { checkStreamHealth } from '@/lib/stream-health';

const schema = z.object({
  name: z.string().min(1).max(180).optional(),
  streamUrl: z.string().url().optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal('')),
  groupTitle: z.string().max(180).nullable().optional(),
  tvgId: z.string().max(180).nullable().optional(),
  tvgName: z.string().max(180).nullable().optional(),
  streamUrlOverride: z.string().url().nullable().optional().or(z.literal('')),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = await db.channel.findUnique({where:{id},include:{playlist:true}});
  if (!channel) return NextResponse.json({error:'Channel not found'},{status:404});
  return NextResponse.json(channel);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(); if (denied) return denied;
  const { id } = await params;
  const existing = await db.channel.findUnique({where:{id}});
  if (!existing) return NextResponse.json({error:'Channel not found'},{status:404});
  const body = schema.parse(await req.json());
  const override = body.streamUrlOverride === '' ? null : body.streamUrlOverride;
  const effectiveUrl = override || body.streamUrl || existing.streamUrlOverride || existing.streamUrl;

  const data: any = {...body};
  if (data.logoUrl === '') data.logoUrl = null;
  if (data.streamUrlOverride === '') data.streamUrlOverride = null;
  delete data.streamUrl;
  data.healthStatus = 'CHECKING';
  data.healthError = null;

  const updated = await db.channel.update({where:{id},data});
  const health = await checkStreamHealth(effectiveUrl);
  const final = await db.channel.update({
    where:{id},
    data:{healthStatus:health.status,healthError:health.error || null,lastCheckedAt:new Date(),...(health.status === 'ACTIVE' ? {lastOnlineAt:new Date()} : {})}
  });
  return NextResponse.json(final);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(); if (denied) return denied;
  const { id } = await params;
  await db.channel.delete({where:{id}});
  return new Response(null,{status:204});
}
