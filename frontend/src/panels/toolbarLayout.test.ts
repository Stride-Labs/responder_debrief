import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'panels.css'),
  'utf8',
);

describe('map toolbar', () => {
  it('stacks through tablet so search stays off the right panel', () => {
    // iPad is 834px. Back + basemap + a 280px search row runs into the
    // 320px overlay sidebar. Phones already stack the toolbar; tablet
    // must do the same (max-width 1023, or the 768–1023 band).
    const stacksThroughTablet =
      /@media \(max-width: 1023px\)[\s\S]{0,240}\.rd-map-toolbar[\s\S]{0,160}flex-direction:\s*column/.test(css)
      || /@media \(min-width: 768px\) and \(max-width: 1023px\)[\s\S]{0,480}\.rd-map-toolbar[\s\S]{0,160}flex-direction:\s*column/.test(css);
    expect(stacksThroughTablet).toBe(true);
  });
});
