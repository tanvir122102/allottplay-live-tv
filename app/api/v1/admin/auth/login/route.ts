import { NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimit, clientKey } from '@/lib/rate-limit';
import { rejectCrossOrigin } from '@/lib/request-security';
import {
  adminCookieName,
  createSession,
  verifyPassword,
} from '@/lib/admin-auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {

  const csrf = rejectCrossOrigin(req);
  if (csrf) {
    return csrf;
  }

  const rl = rateLimit(
    clientKey(req, 'admin-login'),
    5,
    15 * 60 * 1000
  );

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfter),
        },
      }
    );
  }

  try {
    const rawBody = await req.json();
    const body = schema.parse(rawBody);

    const email = (process.env.ADMIN_EMAIL || '').trim();
    const submittedEmail = body.email.trim();
    const emailOk = !!email && submittedEmail.toLowerCase() === email.toLowerCase();
    const passOk = verifyPassword(body.password);

    if (!emailOk || !passOk) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: adminCookieName,
      value: createSession(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (err) {
   console.error('login catch error:', err);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}