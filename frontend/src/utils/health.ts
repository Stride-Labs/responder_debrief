/**
 * Pure helpers for the /health page's outage reporting.
 */
import type { HealthDoc } from '../api/types';

export type HealthHistoryRow = NonNullable<HealthDoc['history']>[number];

export const OUTAGE_WINDOW_MS = 7 * 86_400_000;

/** Failed heartbeat rows inside the window, newest first, capped. */
export function recentOutages(
  history: HealthDoc['history'] | undefined,
  nowMs: number,
  windowMs: number = OUTAGE_WINDOW_MS,
  cap = 10,
): HealthHistoryRow[] {
  return (history ?? [])
    .filter((h) => !h.ok && Number.isFinite(Date.parse(h.at)) && nowMs - Date.parse(h.at) <= windowMs)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, cap);
}
