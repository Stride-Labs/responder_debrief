import { describe, expect, it } from 'vitest';
import type { Map as MlMap } from 'maplibre-gl';
import { beforeIdFor, ensureOrder, type RdLayerId } from './zOrder';

/**
 * Minimal stand-in for the parts of the style MapLibre exposes to zOrder:
 * an ordered layer list that addLayer/moveLayer splice into. The basemap is
 * a fill (ground), a line (roads) and a symbol (labels) — the symbol is the
 * anchor every below-label raster has to land in front of.
 */
function fakeMap(rdLayers: RdLayerId[]): MlMap {
  const layers: { id: string; type: string }[] = [
    { id: 'bm-background', type: 'background' },
    { id: 'bm-roads', type: 'line' },
    { id: 'bm-labels', type: 'symbol' },
  ];
  const map = {
    getStyle: () => ({ layers }),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    moveLayer(id: string, beforeId?: string) {
      const from = layers.findIndex((l) => l.id === id);
      const [moved] = layers.splice(from, 1);
      const at = beforeId ? layers.findIndex((l) => l.id === beforeId) : layers.length;
      layers.splice(at === -1 ? layers.length : at, 0, moved);
    },
  } as unknown as MlMap;

  // Seed in the order the layer managers happen to fire, not canonical order.
  for (const id of rdLayers) {
    const at = layers.findIndex((l) => l.id === beforeIdFor(map, id));
    const layer = { id, type: 'raster' };
    layers.splice(at === -1 ? layers.length : at, 0, layer);
  }
  return map;
}

const stack = (map: MlMap): string[] => (map.getStyle()?.layers ?? []).map((l) => l.id);

// Two weather products, both crossfade members apiece: the stack has to hold
// with a pair mid-swap, which is the state most of a playback session is in.
const RASTERS: RdLayerId[] = [
  'rd-incident-map',
  'rd-spread-forecast',
  'rd-weather-rh-a',
  'rd-weather-rh-b',
  'rd-weather-smoke-a',
  'rd-weather-smoke-b',
  'rd-traffic',
  'rd-national-perimeters',
];

const EXPECTED = ['bm-background', 'bm-roads', ...RASTERS, 'bm-labels'];

describe('raster z-order', () => {
  it('paints weather over the forecast and both over the incident map', () => {
    // Reversed: the worst case for insertion, every layer added below one
    // that is already mounted.
    const map = fakeMap([...RASTERS].reverse());
    expect(stack(map)).toEqual(EXPECTED);
  });

  it('keeps every raster under the basemap labels', () => {
    const map = fakeMap(RASTERS);
    const labels = stack(map).indexOf('bm-labels');
    for (const id of RASTERS) expect(stack(map).indexOf(id)).toBeLessThan(labels);
  });

  it('re-asserts the same stack after layers land out of order', () => {
    const map = fakeMap(RASTERS);
    map.moveLayer('rd-incident-map'); // a stray add lands it on top
    expect(stack(map).at(-1)).toBe('rd-incident-map');

    ensureOrder(map);
    expect(stack(map)).toEqual(EXPECTED);
  });
});
