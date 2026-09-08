import { describe, expect, it } from 'vitest';
import { recentOutages } from './health';

const NOW = Date.parse('2026-09-08T13:00:00Z');

describe('recentOutages', () => {
  it('keeps only failed rows inside the window, newest first', () => {
    const rows = recentOutages(
      [
        { job: 'mirror', at: '2026-09-06T13:11:41Z', ok: false, note: 'FTP unreachable' },
        { job: 'mirror', at: '2026-09-07T01:30:00Z', ok: true, note: null },
        { job: 'mirror', at: '2026-09-06T23:12:05Z', ok: false, note: 'FTP unreachable' },
        { job: 'catalogs', at: '2026-08-20T00:00:00Z', ok: false, note: 'old' },
        { job: 'mirror', at: 'garbage', ok: false, note: 'bad stamp' },
      ],
      NOW,
    );
    expect(rows.map((r) => r.at)).toEqual(['2026-09-06T23:12:05Z', '2026-09-06T13:11:41Z']);
  });

  it('caps the list and tolerates a missing history', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      job: 'mirror',
      at: new Date(NOW - i * 3_600_000).toISOString(),
      ok: false,
      note: null,
    }));
    expect(recentOutages(many, NOW)).toHaveLength(10);
    expect(recentOutages(undefined, NOW)).toEqual([]);
  });
});
