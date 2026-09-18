import { NextResponse } from 'next/server';
import { runHealthChecks } from '@/lib/health-runner';

export const runtime = 'nodejs';

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json(await runHealthChecks());
}

export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
