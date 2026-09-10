import { describe, expect, it } from 'vitest';
import { RD_LAYER_ORDER } from './zOrder';

describe('RD_LAYER_ORDER', () => {
  it('draws weather rasters over the incident-map sheet', () => {
    const incident = RD_LAYER_ORDER.indexOf('rd-incident-map');
    const weatherIdx = RD_LAYER_ORDER
      .map((id, i) => (id.startsWith('rd-weather-') ? i : -1))
      .filter((i) => i >= 0);
    expect(incident).toBeGreaterThan(-1);
    expect(weatherIdx.length).toBeGreaterThan(0);
    expect(Math.min(...weatherIdx)).toBeGreaterThan(incident);
  });
});
