import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/prisma';

function jsonCached(data: unknown) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } });
}

export async function GET() {
  const s = await db.siteSettings.findUnique({ where: { id: 1 } });
  const settings = s ?? { websiteName: 'LIVE TV', websiteUrl: '', websiteLogoUrl: '', showPlayerBrand: true, playerBrandPosition: 'bottom', brandTextSize: 9 };
  return jsonCached({ ...settings, poweredBy: 'ALL OTT PLAY' });
}