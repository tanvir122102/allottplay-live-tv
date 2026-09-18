import { db } from '@/lib/prisma';
import { checkStreamHealth } from '@/lib/stream-health';

export async function runHealthChecks(options?: { batchSize?: number; intervalMinutes?: number; concurrency?: number }) {
  const batchSize = Math.min(Math.max(options?.batchSize ?? Number(process.env.HEALTH_CHECK_BATCH_SIZE || 50), 1), 200);
  const intervalMs = Math.max(options?.intervalMinutes ?? Number(process.env.HEALTH_CHECK_INTERVAL_MINUTES || 10), 1) * 60_000;
  const cutoff = new Date(Date.now() - intervalMs);
  const channels = await db.channel.findMany({
    where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }] },
    take: batchSize,
    orderBy: { lastCheckedAt: 'asc' },
  });
  let active = 0, inactive = 0;
  const concurrency = Math.min(options?.concurrency ?? Number(process.env.HEALTH_CHECK_CONCURRENCY || 8), 20);
  for (let i = 0; i < channels.length; i += concurrency) {
    const chunk = channels.slice(i, i + concurrency);
    await Promise.all(chunk.map(async channel => {
      const result = await checkStreamHealth(channel.streamUrlOverride || channel.streamUrl, channel.sourceType);
      if (result.status === 'ACTIVE') active++; else inactive++;
      await db.channel.update({ where: { id: channel.id }, data: { healthStatus: result.status, healthError: result.error || null, lastCheckedAt: new Date(), ...(result.status === 'ACTIVE' ? { lastOnlineAt: new Date() } : {}) } });
    }));
  }
  return { checked: channels.length, active, inactive };
}

export async function runHealthChecksUntilDone(options?: { batchSize?: number; intervalMinutes?: number; concurrency?: number; maxBatches?: number }) {
  const maxBatches = options?.maxBatches ?? 100;
  let totalChecked = 0, totalActive = 0, totalInactive = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const result = await runHealthChecks(options);
    totalChecked += result.checked;
    totalActive += result.active;
    totalInactive += result.inactive;
    if (result.checked === 0) break;
  }
  return { checked: totalChecked, active: totalActive, inactive: totalInactive };
}