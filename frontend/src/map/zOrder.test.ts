import { describe, expect, it } from 'vitest';
import type { Map as MlMap } from 'maplibre-gl';
import { RD_LAYER_ORDER, beforeIdFor, ensureOrder, firstSymbolLayerId } from './zOrder';

const rank = (id: string): number => RD_LAYER_ORDER.indexOf(id as never);

const WEATHER = RD_LAYER_ORDER.filter((id) => id.startsWith('rd-weather-'));
const ABOVE_LABELS = ['rd-wind-arrows', 'rd-perimeter-fill', 'rd-hotspots', 'rd-route-line'];

/**
 * Minimal MapLibre stand-in: an ordered layer list plus the four methods
 * zOrder touches. moveLayer splices, matching MapLibre's own semantics
 * ("place this layer immediately below beforeId, or on top when omitted").
 */
function fakeMap(present: string[], symbolIds: string[] = ['basemap-labels']) {
  const layers = [...present];
  const moves: string[] = [];
  const map = {
    getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
    getStyle: () => ({
      layers: layers.map((id) => ({ id, type: symbolIds.includes(id) ? 'symbol' : 'raster' })),
    }),
    moveLayer: (id: string, beforeId?: string) => {
      moves.push(`${id}→${beforeId ?? 'TOP'}`);
      layers.splice(layers.indexOf(id), 1);
      const at = beforeId ? layers.indexOf(beforeId) : layers.length;
      layers.splice(at, 0, id);
    },
  } as unknown as MlMap;
  return { map, layers, moves };
}

describe('canonical stacking', () => {
  it('puts every weather raster above the spread forecast', () => {
    for (const id of WEATHER) {
      expect(rank(id)).toBeGreaterThan(rank('rd-spread-forecast'));
    }
  });

  it('puts the spread forecast above the incident map', () => {
    expect(rank('rd-spread-forecast')).toBeGreaterThan(rank('rd-incident-map'));
  });

  it('leaves the incident map as the floor of the raster stack', () => {
    expect(rank('rd-incident-map')).toBe(0);
  });

  it('keeps traffic legible above the weather wash', () => {
    for (const id of WEATHER) expect(rank('rd-traffic')).toBeGreaterThan(rank(id));
  });

  it('keeps every raster below every vector', () => {
    const highestRaster = Math.max(rank('rd-traffic'), ...WEATHER.map(rank));
    for (const id of ABOVE_LABELS) expect(rank(id)).toBeGreaterThan(highestRaster);
  });

  it('declares each id exactly once', () => {
    expect(new Set(RD_LAYER_ORDER).size).toBe(RD_LAYER_ORDER.length);
  });
});

describe('beforeIdFor', () => {
  it('inserts the incident map beneath an already-present weather raster', () => {
    const { map } = fakeMap(['rd-weather-smoke-a', 'basemap-labels']);
    expect(beforeIdFor(map, 'rd-incident-map')).toBe('rd-weather-smoke-a');
  });

  it('inserts a weather raster above the forecast, beneath traffic', () => {
    const { map } = fakeMap(['rd-spread-forecast', 'rd-traffic', 'basemap-labels']);
    expect(beforeIdFor(map, 'rd-weather-smoke-a')).toBe('rd-traffic');
  });

  it('caps a raster at the first basemap symbol layer when nothing sits above it', () => {
    const { map } = fakeMap(['rd-incident-map', 'basemap-labels']);
    expect(beforeIdFor(map, 'rd-traffic')).toBe('basemap-labels');
  });

  it('never returns a below-label neighbour for an above-label vector', () => {
    const { map } = fakeMap(['rd-weather-smoke-a', 'rd-traffic', 'basemap-labels']);
    expect(beforeIdFor(map, 'rd-hotspots')).toBeUndefined();
  });

  it('sends an above-label vector to the map top when nothing sits above it', () => {
    const { map } = fakeMap(['rd-hotspots', 'basemap-labels']);
    expect(beforeIdFor(map, 'rd-route-line')).toBeUndefined();
  });

  it('ignores basemap symbol layers our own layers shadow', () => {
    const { map } = fakeMap(['rd-labels-x', 'basemap-labels'], ['rd-labels-x', 'basemap-labels']);
    expect(firstSymbolLayerId(map)).toBe('basemap-labels');
  });
});

describe('ensureOrder', () => {
  it('restores canonical order from a scrambled stack', () => {
    const scrambled = [
      'rd-weather-smoke-a',
      'rd-hotspots',
      'rd-spread-forecast',
      'basemap-labels',
      'rd-incident-map',
      'rd-route-line',
      'rd-traffic',
    ];
    const { map, layers } = fakeMap(scrambled);
    ensureOrder(map);
    expect(layers).toEqual([
      'rd-incident-map',
      'rd-spread-forecast',
      'rd-weather-smoke-a',
      'rd-traffic',
      'basemap-labels',
      'rd-hotspots',
      'rd-route-line',
    ]);
  });

  it('is idempotent — a second pass moves nothing that changes the result', () => {
    const { map, layers } = fakeMap([
      'rd-incident-map',
      'rd-spread-forecast',
      'rd-weather-smoke-a',
      'basemap-labels',
      'rd-hotspots',
    ]);
    ensureOrder(map);
    const first = [...layers];
    ensureOrder(map);
    expect(layers).toEqual(first);
  });

  it('keeps the whole raster group beneath the basemap labels', () => {
    const { map, layers } = fakeMap([
      'basemap-labels',
      'rd-weather-smoke-a',
      'rd-weather-rh-a',
      'rd-incident-map',
      'rd-spread-forecast',
    ]);
    ensureOrder(map);
    const labelAt = layers.indexOf('basemap-labels');
    for (const id of layers.filter((l) => l !== 'basemap-labels')) {
      expect(layers.indexOf(id)).toBeLessThan(labelAt);
    }
  });
});
