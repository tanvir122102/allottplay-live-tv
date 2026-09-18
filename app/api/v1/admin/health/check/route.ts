import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-guard';
import { runHealthChecks } from '@/lib/health-runner';

export const runtime = 'nodejs';

export async function POST() {
  const denied = await adminGuard(); if (denied) return denied;
  return NextResponse.json(await runHealthChecks());
}
