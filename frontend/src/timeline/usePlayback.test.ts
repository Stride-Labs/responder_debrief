/**
 * Playback pacing. The default speed and the repaint floor are coupled: frame
 * plans are hourly, and at any plausible speed an hourly gap lands on the
 * floor — so the floor, not the speed alone, is what the eye actually reads as
 * playback rate. Both have to move together or "faster" changes nothing.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYBACK_SPEED } from '../app/config';
import { MIN_STEP_MS, stepDelayMs } from './usePlayback';

/** What playback looked like before the speed-up, for the halving assertions. */
const PREVIOUS_SPEED = 10;
const PREVIOUS_MIN_STEP_MS = 120;

describe('stepDelayMs', () => {
  it('scales the delay with the model-time gap', () => {
    expect(stepDelayMs(3, 10)).toBe(300);
    expect(stepDelayMs(6, 10)).toBe(600);
  });

  it('never drops below the repaint floor', () => {
    expect(stepDelayMs(0.1, DEFAULT_PLAYBACK_SPEED)).toBe(MIN_STEP_MS);
  });

  it('halves the delay when the speed doubles', () => {
    expect(stepDelayMs(4, 2 * PREVIOUS_SPEED)).toBe(stepDelayMs(4, PREVIOUS_SPEED) / 2);
  });
});

describe('the doubled default', () => {
  it('doubles the speed', () => {
    expect(DEFAULT_PLAYBACK_SPEED).toBe(2 * PREVIOUS_SPEED);
  });

  it('halves the wall-clock step for an hourly frame, the common case', () => {
    // Hourly gaps sit on the floor at both speeds, so the floor has to halve too.
    expect(stepDelayMs(1, DEFAULT_PLAYBACK_SPEED)).toBe(
      Math.max(PREVIOUS_MIN_STEP_MS, 1000 / PREVIOUS_SPEED) / 2,
    );
  });

  it('halves the wall-clock step for a multi-hour frame gap too', () => {
    expect(stepDelayMs(6, DEFAULT_PLAYBACK_SPEED)).toBe(
      Math.max(PREVIOUS_MIN_STEP_MS, (6 * 1000) / PREVIOUS_SPEED) / 2,
    );
  });
});
