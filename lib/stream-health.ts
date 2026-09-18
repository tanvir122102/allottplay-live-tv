import { safeFetch } from '@/lib/safe-remote-url';
export type HealthResult = {
  status: 'ACTIVE' | 'INACTIVE';
  error?: string;
};

const timeoutMs = Number(process.env.STREAM_HEALTH_TIMEOUT_MS || 8000);

function absoluteUrl(base: string, candidate: string) {
  try { return new URL(candidate, base).toString(); } catch { return null; }
}

async function fetchText(url: string) {
  const res = await safeFetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { 'User-Agent': 'LiveTV-HealthChecker/1.0', Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { res, text: await res.text() };
}

function firstUrlFromManifest(text: string, base: string) {
  return text.split(/\r?\n/)
    .map(x => x.trim())
    .filter(x => x && !x.startsWith('#'))
    .map(x => absoluteUrl(base, x))
    .find(Boolean) || null;
}

export async function checkStreamHealth(url: string, sourceType: string = 'hls'): Promise<HealthResult> {
  if (sourceType === 'embed') {
    try {
      const res = await safeFetch(url, {
        cache: 'no-store',
        redirect: 'follow',
        method: 'GET',
        headers: { 'User-Agent': 'LiveTV-HealthChecker/1.0', Accept: '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 'ACTIVE' };
    } catch (error) {
      return { status: 'INACTIVE', error: error instanceof Error ? error.message.slice(0, 180) : 'Embed unreachable' };
    }
  }

  try {
    const { res, text } = await fetchText(url);
    const contentType = res.headers.get('content-type') || '';
    const looksHls = contentType.includes('mpegurl') || /#EXTM3U/i.test(text) || /\.m3u8(?:$|\?)/i.test(url);

    if (!looksHls) return { status: 'ACTIVE' };

    if (!/#EXTM3U/i.test(text)) throw new Error('Invalid HLS manifest');

    if (/#EXT-X-STREAM-INF/i.test(text)) {
      const variant = firstUrlFromManifest(text, url);
      if (!variant) throw new Error('No HLS variant found');
      const child = await fetchText(variant);
      if (!/#EXTM3U/i.test(child.text)) throw new Error('Invalid HLS media playlist');
      return { status: 'ACTIVE' };
    }

    if (/#EXTINF:/i.test(text) || /#EXT-X-PART:/i.test(text)) return { status: 'ACTIVE' };
    if (/#EXT-X-ENDLIST/i.test(text)) return { status: 'ACTIVE' };

    throw new Error('HLS playlist has no media entries');
  } catch (error) {
    return { status: 'INACTIVE', error: error instanceof Error ? error.message.slice(0, 180) : 'Health check failed' };
  }
}