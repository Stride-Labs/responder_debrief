import { describe, expect, it } from 'vitest';
import { isFireViewReady, isPerimeterSettled } from './fireReady';
import { isForecastSettled } from './layers/spreadForecastLayer';
import { isWeatherSettled } from './layers/weatherLayers';
import { isIncidentMapSettled } from './layers/incidentMapLayer';
import type { PyrecastRun, WeatherRun } from '../api/types';

/**
 * The invariant these tests defend: the ready predicates must SETTLE for
 * every seedable state — a layer that can never paint (absent from the
 * catalog, failed load, playhead outside coverage) must not block
 * rd-fire-ready forever. Only genuinely in-flight work may return false.
 */

const allSettled = { perimeter: true, weather: true, forecast: true, sheet: true };

describe('isFireViewReady', () => {
  it('ready only when every layer settled', () => {
    expect(isFireViewReady(allSettled)).toBe(true);
    for (const k of ['perimeter', 'weather', 'forecast', 'sheet'] as const) {
      expect(isFireViewReady({ ...allSettled, [k]: false })).toBe(false);
    }
  });
});

describe('isPerimeterSettled', () => {
  it('hidden outline settles immediately (pm=0 seeds)', () => {
    expect(
      isPerimeterSettled({
        visible: false, indexLoaded: false, hasVersion: false, featureLanded: false,
      }),
    ).toBe(true);
  });

  it('pending while the version index loads', () => {
    expect(
      isPerimeterSettled({
        visible: true, indexLoaded: false, hasVersion: false, featureLanded: false,
      }),
    ).toBe(false);
  });

  it('a fire with no perimeter versions settles — nothing will ever land', () => {
    expect(
      isPerimeterSettled({
        visible: true, indexLoaded: true, hasVersion: false, featureLanded: false,
      }),
    ).toBe(true);
  });

  it('waits for the feature when a version exists', () => {
    expect(
      isPerimeterSettled({
        visible: true, indexLoaded: true, hasVersion: true, featureLanded: false,
      }),
    ).toBe(false);
    expect(
      isPerimeterSettled({
        visible: true, indexLoaded: true, hasVersion: true, featureLanded: true,
      }),
    ).toBe(true);
  });
});

describe('isForecastSettled — absent data settles instead of hanging', () => {
  const layersOn = {
    layers: { spread: { visible: true, product: 'crown-fire' as never, percentile: 90 } },
  };

  it('hidden forecast settles immediately', () => {
    expect(
      isForecastSettled(
        { layers: { spread: { visible: false, product: 'crown-fire' as never, percentile: 90 } }, spreadRun: null },
        false,
      ),
    ).toBe(true);
  });

  it('pending while the pyrecast catalog loads', () => {
    expect(isForecastSettled({ ...layersOn, spreadRun: null }, false)).toBe(false);
  });

  it('no renderable run settles once the catalog answered', () => {
    // Before this fix: returned false forever — a seeded ff on a fire with
    // no run left rd-fire-ready unmounted past any timeout.
    expect(isForecastSettled({ ...layersOn, spreadRun: null }, true)).toBe(true);
  });

  it('product absent from the run settles', () => {
    const run = {
      workspace: 'ws1',
      products: {},
      toa: { percentiles: [90] },
    } as unknown as PyrecastRun;
    expect(isForecastSettled({ ...layersOn, spreadRun: run }, true)).toBe(true);
  });

  it('a loadable product that has not painted yet stays pending', () => {
    const run = {
      workspace: 'ws1',
      products: { 'crown-fire': { percentiles: [90], legend_stops: [] } },
      toa: { percentiles: [90] },
    } as unknown as PyrecastRun;
    expect(isForecastSettled({ ...layersOn, spreadRun: run }, true)).toBe(false);
  });
});

describe('isWeatherSettled — no run / no frame settles instead of hanging', () => {
  const smokeOn = { layers: { weather: { smoke: { visible: true } } } };

  it('no visible weather settles immediately', () => {
    expect(
      isWeatherSettled({ layers: { weather: {} }, weatherRun: null, currentTime: 0 }, false),
    ).toBe(true);
  });

  it('pending while the weather catalog loads', () => {
    expect(
      isWeatherSettled({ ...smokeOn, weatherRun: null, currentTime: 0 }, false),
    ).toBe(false);
  });

  it('no run settles once the catalog answered', () => {
    expect(
      isWeatherSettled({ ...smokeOn, weatherRun: null, currentTime: 0 }, true),
    ).toBe(true);
  });

  it('playhead outside frame coverage settles — the pair hides, nothing paints', () => {
    // Before this fix: returned false forever when the seeded scrub time had
    // no weather frame within tolerance.
    const run = {
      run_time: '2026-09-10T00:00:00Z',
      frames: { hours: ['2026-09-10T00:00:00Z'], bounds: [-125, 24.5, -66.5, 49.5] },
    } as unknown as WeatherRun;
    const farFuture = Date.parse('2026-09-20T00:00:00Z');
    expect(
      isWeatherSettled({ ...smokeOn, weatherRun: run, currentTime: farFuture }, true),
    ).toBe(true);
  });

  it('a resolvable frame that has not painted yet stays pending', () => {
    const run = {
      run_time: '2026-09-10T00:00:00Z',
      path: 'weather/hrrr/run',
      frames: { hours: ['2026-09-10T00:00:00Z'], bounds: [-125, 24.5, -66.5, 49.5] },
    } as unknown as WeatherRun;
    const atRun = Date.parse('2026-09-10T00:00:00Z');
    expect(
      isWeatherSettled({ ...smokeOn, weatherRun: run, currentTime: atRun }, true),
    ).toBe(false);
  });
});

describe('isIncidentMapSettled — missing sheet settles instead of hanging', () => {
  it('no pinned sheet settles immediately', () => {
    expect(
      isIncidentMapSettled(
        { layers: { incidentMap: { mapId: null, series: null } }, incidentManifest: undefined, currentTime: 0 },
        false,
      ),
    ).toBe(true);
  });

  it('pending while the manifest loads', () => {
    expect(
      isIncidentMapSettled(
        { layers: { incidentMap: { mapId: 'sheet-1', series: null } }, incidentManifest: undefined, currentTime: 0 },
        false,
      ),
    ).toBe(false);
  });

  it('sheet absent from the loaded manifest settles', () => {
    expect(
      isIncidentMapSettled(
        { layers: { incidentMap: { mapId: 'gone', series: null } }, incidentManifest: { maps: [] }, currentTime: 0 },
        true,
      ),
    ).toBe(true);
  });

  it('a present sheet whose tiles have not loaded stays pending', () => {
    const manifest = {
      maps: [
        {
          id: 'sheet-1',
          rev: 1,
          tiles: {
            url_template: 't/{z}/{x}/{y}.png', minzoom: 8, maxzoom: 14,
            bounds: [-120, 44, -119, 45],
          },
        } as never,
      ],
    };
    expect(
      isIncidentMapSettled(
        { layers: { incidentMap: { mapId: 'sheet-1', series: null } }, incidentManifest: manifest, currentTime: 0 },
        true,
      ),
    ).toBe(false);
  });
});
