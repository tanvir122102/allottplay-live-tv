import { NextResponse } from 'next/server';

export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return origin === new URL(req.url).origin; } catch { return false; }
}

export function rejectCrossOrigin(req: Request) {
  if (sameOrigin(req)) return null;
  return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
