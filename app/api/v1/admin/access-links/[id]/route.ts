import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { revokeAccessLink, deleteAccessLink } from '@/lib/access-links';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const link = await revokeAccessLink(id);
  return NextResponse.json(link);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await deleteAccessLink(id);
  return NextResponse.json({ ok: true });
}