import { createHash } from 'node:crypto';

export type ParsedChannel = {
  sourceKey: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  sourceType: 'hls' | 'embed';
};

function attr(line: string, key: string) {
  const m = line.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'));
  return m?.[1]?.trim() || undefined;
}

function sourceKeyOf(name: string, _streamUrl: string, tvgId?: string, groupTitle?: string) {
  const stable = `${tvgId || ''}\n${groupTitle || ''}\n${name.trim().toLowerCase()}`;
  return createHash('sha256').update(stable).digest('hex').slice(0, 40);
}

function detectSourceType(info: string, streamUrl: string): 'hls' | 'embed' {
  const explicit = attr(info, 'type');
  if (explicit === 'embed') return 'embed';
  if (explicit === 'hls') return 'hls';
  return /\.m3u8(?:$|[?#])/i.test(streamUrl) ? 'hls' : 'hls';
}

export function parseM3U(text: string): ParsedChannel[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const out: ParsedChannel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const info = lines[i];
    if (!info.toUpperCase().startsWith('#EXTINF')) continue;

    const streamUrl = lines[i + 1];
    if (!streamUrl || streamUrl.startsWith('#')) continue;

    const comma = info.indexOf(',');
    const tvgName = attr(info, 'tvg-name');
    const name = comma >= 0 ? info.slice(comma + 1).trim() : (tvgName || 'Unknown Channel');
    const tvgId = attr(info, 'tvg-id');

    out.push({
      sourceKey: sourceKeyOf(name, streamUrl, tvgId, attr(info, 'group-title')),
      name,
      streamUrl,
      logoUrl: attr(info, 'tvg-logo'),
      groupTitle: attr(info, 'group-title'),
      tvgId,
      tvgName,
      sourceType: detectSourceType(info, streamUrl),
    });
    i++;
  }

  return out;
}