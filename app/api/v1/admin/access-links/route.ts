import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/lib/admin-auth';
import { createAccessLink, listAccessLinks } from '@/lib/access-links';

const schema = z.object({
  expiresAt: z.string().datetime(),
  label: z.string().trim().max(80).optional(),
  maxDevices: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const links = await listAccessLinks();
  return NextResponse.json(links);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const link = await createAccessLink(new Date(parsed.data.expiresAt), parsed.data.label, parsed.data.maxDevices ?? null);
  return NextResponse.json(link, { status: 201 });
}