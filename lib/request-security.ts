import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://7kb896.bot-keep.xyz',
]);

export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');

  // Requests without Origin are not rejected by this check.
  if (!origin) return true;

  return ALLOWED_ORIGINS.has(origin);
}

export function rejectCrossOrigin(req: Request) {
  if (sameOrigin(req)) return null;

  return NextResponse.json(
    { error: 'Cross-origin request blocked' },
    { status: 403 }
  );
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}