import { describe, expect, it } from 'vitest';
import { fireReadyNeeds, isFireViewReady, type FireReadyLayers } from './fireReady';

const base = (): FireReadyLayers => ({
  perimeters: { visible: true },
  spread: { visible: false },
  weather: {},
  incidentMap: { mapId: null, series: null },
});

describe('fireReadyNeeds — marker follows the seeded view', () => {
  it('default fire (no overlays) waits for the outline', () => {
    expect(fireReadyNeeds(base())).toEqual(['perimeter']);
  });

  it('story 2: forecast + smoke + sheet, no outline wait', () => {
    // The review that failed waited for rd-fire-perimeter on this view.
    expect(
      fireReadyNeeds({
        perimeters: { visible: true },
        spread: { visible: true },
        weather: { smoke: { visible: true } },
        incidentMap: { mapId: '960806837edb2fc8', series: null },
      }),
    ).toEqual(['weather', 'forecast', 'sheet']);
  });

  it('story 1: smoke over the map sheet waits for those, not the outline', () => {
    expect(
      fireReadyNeeds({
        ...base(),
        weather: { smoke: { visible: true } },
        incidentMap: { mapId: 'sheet-1', series: null },
      }),
    ).toEqual(['weather', 'sheet']);
  });

  it('temperature raster only waits for weather', () => {
    expect(
      fireReadyNeeds({
        ...base(),
        weather: { tmpf: { visible: true } },
      }),
    ).toEqual(['weather']);
  });

  it('forecast only waits for the forecast', () => {
    expect(
      fireReadyNeeds({
        ...base(),
        spread: { visible: true },
      }),
    ).toEqual(['forecast']);
  });

  it('pinned sheet only waits for the sheet', () => {
    expect(
      fireReadyNeeds({
        ...base(),
        incidentMap: { mapId: 'sheet-1', series: null },
      }),
    ).toEqual(['sheet']);
  });

  it('pm=0 with no overlays waits for nothing (chrome is enough)', () => {
    expect(
      fireReadyNeeds({
        ...base(),
        perimeters: { visible: false },
      }),
    ).toEqual([]);
  });

  it('pm=0 plus forecast waits for the forecast only', () => {
    expect(
      fireReadyNeeds({
        perimeters: { visible: false },
        spread: { visible: true },
        weather: {},
        incidentMap: { mapId: null, series: null },
      }),
    ).toEqual(['forecast']);
  });
});

describe('isFireViewReady', () => {
  it('story 2 is ready once weather, forecast, and sheet landed — outline optional', () => {
    expect(
      isFireViewReady({
        needs: ['weather', 'forecast', 'sheet'],
        perimeterLanded: false,
        weatherLanded: true,
        forecastLanded: true,
        sheetLanded: true,
      }),
    ).toBe(true);
  });

  it('story 2 is not ready if the forecast has not painted', () => {
    expect(
      isFireViewReady({
        needs: ['weather', 'forecast', 'sheet'],
        perimeterLanded: true,
        weatherLanded: true,
        forecastLanded: false,
        sheetLanded: true,
      }),
    ).toBe(false);
  });

  it('default fire is ready when the outline GeoJSON landed', () => {
    expect(
      isFireViewReady({
        needs: ['perimeter'],
        perimeterLanded: true,
        weatherLanded: false,
        forecastLanded: false,
        sheetLanded: false,
      }),
    ).toBe(true);
  });

  it('empty needs (hidden outline, no overlays) is ready immediately', () => {
    expect(
      isFireViewReady({
        needs: [],
        perimeterLanded: false,
        weatherLanded: false,
        forecastLanded: false,
        sheetLanded: false,
      }),
    ).toBe(true);
  });
});
