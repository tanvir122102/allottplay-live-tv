import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://7kb896.bot-keep.xyz',
]);

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');

  // Keep requests without Origin compatible with non-browser clients.
  if (!origin) return true;

  const allowed = ALLOWED_ORIGINS.has(origin);

  console.log('[ORIGIN CHECK]', {
    origin,
    allowed,
  });

  return allowed;
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