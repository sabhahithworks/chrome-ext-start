import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { addLogSink, type LogEntry } from '@/lib/logger';
import {
  SYNC_ALARM,
  ensureSyncAlarm,
  registerAlarmJob,
  resetAlarmJobsForTest,
  runAlarmJobs,
} from '@/background/alarms';

describe('alarms', () => {
  beforeEach(async () => {
    resetAlarmJobsForTest();
    await fakeBrowser.alarms.clearAll();
  });

  test('does not recreate existing alarm', async () => {
    await ensureSyncAlarm();
    await ensureSyncAlarm();
    const all = await fakeBrowser.alarms.getAll();
    expect(all.length).toBe(1);
    expect(all).toEqual([expect.objectContaining({ name: SYNC_ALARM, periodInMinutes: 15 })]);
  });

  test('one failing job does not stop others', async () => {
    registerAlarmJob('a', () => Promise.reject(new Error('boom')));
    registerAlarmJob('b', () => Promise.resolve());
    const entries: LogEntry[] = [];
    const remove = addLogSink({ write: (e) => entries.push(e) });
    try {
      expect(await runAlarmJobs()).toEqual([
        { name: 'a', ok: false },
        { name: 'b', ok: true },
      ]);
    } finally {
      remove();
    }
    const failed = entries.filter((e) => e.message === 'alarm job failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.context).toMatchObject({ job: 'a' });
  });

  test('synchronous throw is a job failure and others still run', async () => {
    registerAlarmJob('a', () => {
      throw new Error('sync');
    });
    registerAlarmJob('b', () => Promise.resolve());
    expect(await runAlarmJobs()).toEqual([
      { name: 'a', ok: false },
      { name: 'b', ok: true },
    ]);
  });

  test('rejects duplicate job name', () => {
    registerAlarmJob('a', () => Promise.resolve());
    expect(() => {
      registerAlarmJob('a', () => Promise.resolve());
    }).toThrow('duplicate alarm job: a');
  });

  test('no jobs returns empty list', async () => {
    expect(await runAlarmJobs()).toEqual([]);
  });
});
