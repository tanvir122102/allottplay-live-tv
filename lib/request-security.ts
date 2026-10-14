import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://7kb896.bot-keep.xyz',
]);

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');

  // Requests without an Origin header are allowed by this check.
  // Authentication and other security checks must still run.
  if (!origin) {
    return true;
  }

  let requestOrigin: string;

  try {
    requestOrigin = new URL(req.url).origin;
  } catch {
    console.error('[ORIGIN DEBUG] Invalid request URL');
    return false;
  }

  console.log('[ORIGIN DEBUG]', {
    origin,
    requestOrigin,
    originAllowed: ALLOWED_ORIGINS.has(origin),
    matchesRequestOrigin: origin === requestOrigin,
  });

  // Require both an approved public origin and a matching request origin.
  return (
    ALLOWED_ORIGINS.has(origin) &&
    origin === requestOrigin
  );
}

export function rejectCrossOrigin(req: Request) {
  if (sameOrigin(req)) {
    return null;
  }

  return NextResponse.json(
    { error: 'Cross-origin request blocked' },
    { status: 403 }
  );
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}