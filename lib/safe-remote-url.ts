import dns from 'node:dns/promises';
import net from 'node:net';

function privateIPv4(ip: string) {
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0;
}
function privateIPv6(ip: string) {
  const s = ip.toLowerCase();
  if (s.startsWith('::ffff:')) { const mapped = s.slice(7); if (net.isIP(mapped) === 4) return privateIPv4(mapped); }
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80:');
}
function isPrivate(ip: string) { return net.isIP(ip) === 4 ? privateIPv4(ip) : net.isIP(ip) === 6 ? privateIPv6(ip) : false; }

export async function assertSafeRemoteUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed');
  if (process.env.ALLOW_PRIVATE_REMOTE_URLS === 'true') return url;
  if (isPrivate(url.hostname)) throw new Error('Private or local network URLs are not allowed');
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => isPrivate(r.address))) throw new Error('Remote host resolves to a private or local network address');
  return url;
}

export async function safeFetch(raw: string, init: RequestInit & { timeoutMs?: number } = {}) {
  let current = await assertSafeRemoteUrl(raw);
  const timeoutMs = init.timeoutMs ?? 20000;
  const { timeoutMs: _ignored, ...requestInit } = init;
  for (let i = 0; i < 3; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(current, { ...requestInit, redirect: 'manual', signal: controller.signal });
      if ([301,302,303,307,308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) throw new Error('Remote redirect missing location');
        current = await assertSafeRemoteUrl(new URL(location, current).toString());
        continue;
      }
      return res;
    } finally { clearTimeout(timer); }
  }
  throw new Error('Too many remote redirects');
}
