import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'live_tv_admin_session';
const secret = process.env.ADMIN_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-change-me');
if (process.env.NODE_ENV === 'production' && secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters in production');

type SessionPayload = { sub: string; exp: number };

function sign(value: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function verifyPassword(password: string) {
  const stored = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const [scheme, salt, key] = stored.split('$');

  console.log('DEBUG >>> hash present:', !!stored, 'scheme:', scheme, 'saltLen:', salt?.length, 'keyLen:', key?.length);

  if (scheme !== 'scrypt' || !salt || !key) {
    console.log('DEBUG >>> verifyPassword: malformed or missing hash, returning false');
    return false;
  }

  // key length in bytes = hex string length / 2
  const keyLenBytes = key.length / 2;
  const derived = crypto.scryptSync(password, salt, keyLenBytes).toString('hex');

  console.log('DEBUG >>> derivedLen:', derived.length, 'storedKeyLen:', key.length, 'exactMatch:', derived === key);

  return safeEqual(derived, key);
}

export function createSession() {
  const payload: SessionPayload = { sub: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifySession(token?: string | null) {
  if (!token) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
    return payload.sub === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdmin() {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('UNAUTHORIZED');
}

export const adminCookieName = COOKIE;