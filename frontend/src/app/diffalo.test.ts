/**
 * Diffalo review contract. Three things broke a review before these existed:
 * an `account` in the state result, an `expectText` the dump-dom gate could
 * not see, and a fire pathname pinned in diffalo.json that went stale.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assembleResult, PREFERRED_SLUG, slugToPathname } from '../../../scripts/diffalo-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('diffalo.json')) as {
  recordable: {
    expectText: string[];
    places: Record<string, string>;
    routes: Record<string, unknown>;
  };
};

describe('diffalo state result', () => {
  it('never contains an account or clientState key', () => {
    const result = assembleResult('fire-detail', slugToPathname(PREFERRED_SLUG), {});
    expect('account' in result).toBe(false);
    expect('clientState' in result).toBe(false);
  });

  it('asks the recording browser to wait on a testid the app renders', () => {
    const shell = assembleResult('fire-detail', '/fire/x', { ready: 'shell' });
    const perimeter = assembleResult('fire-detail', '/fire/x', {});
    expect(shell.ready).toEqual({ testId: 'rd-fire-shell' });
    expect(perimeter.ready).toEqual({ testId: 'rd-fire-perimeter' });
    expect(read('frontend/src/panels/BackControl.tsx')).toContain('data-testid="rd-fire-shell"');
    expect(read('frontend/src/app/App.tsx')).toContain('data-testid="rd-fire-perimeter"');
  });
});

describe('diffalo.json', () => {
  // The gate renders with --dump-dom, so it reads the served HTML. Text only
  // React paints times out at 90s; text in index.html is there on every route.
  it('declares global expectText that the served HTML already contains', () => {
    const html = read('frontend/index.html');
    for (const text of spec.recordable.expectText) expect(html).toContain(text);
  });

  // routeKey is an exact pathname match and active fires rotate weekly, so a
  // pinned fire path silently hands the fire page the home tagline.
  it('pins no fire pathname', () => {
    expect(Object.keys(spec.recordable.places)).not.toContain('fire');
    for (const route of Object.keys(spec.recordable.routes)) {
      expect(route.startsWith('/fire')).toBe(false);
    }
  });
});
