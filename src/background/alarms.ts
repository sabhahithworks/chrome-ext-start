import { LIMITS } from '@/config/app.config';
import { createLogger } from '@/lib/logger';

const log = createLogger('alarms');

export const SYNC_ALARM = 'sync';

export type AlarmJob = () => Promise<void>;

const jobs = new Map<string, AlarmJob>();

export function registerAlarmJob(name: string, job: AlarmJob): void {
  if (jobs.has(name)) throw new Error('duplicate alarm job: ' + name);
  jobs.set(name, job);
}

export async function ensureSyncAlarm(): Promise<void> {
  const existing = await browser.alarms.get(SYNC_ALARM);
  if (existing) return;
  await browser.alarms.create(SYNC_ALARM, { periodInMinutes: LIMITS.SYNC_ALARM_PERIOD_MIN });
}

export async function runAlarmJobs(): Promise<{ name: string; ok: boolean }[]> {
  const entries = [...jobs.entries()];
  const settled = await Promise.allSettled(entries.map(([, job]) => Promise.resolve().then(job)));
  return entries.map(([name], i) => {
    const result = settled[i];
    if (result?.status === 'fulfilled') return { name, ok: true };
    log.error('alarm job failed', { job: name, error: result?.reason });
    return { name, ok: false };
  });
}

export function resetAlarmJobsForTest(): void {
  jobs.clear();
}
