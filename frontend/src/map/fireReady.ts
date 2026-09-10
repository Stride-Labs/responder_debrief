/**
 * Diffalo waits on `rd-fire-ready` until every layer this view actually
 * turned on has painted. Overlay stories (weather, forecast, map sheet)
 * must not wait for the fire outline — that marker never appears when
 * the seed hid the perimeter, and it is the wrong gate even when the
 * outline is still on.
 *
 * Default fire (no overlays, perimeter still on) still waits for the
 * outline. Shell-only (`ready=shell`) never reaches this helper.
 */
export type FireReadyNeed = 'perimeter' | 'weather' | 'forecast' | 'sheet';

export interface FireReadyLayers {
  perimeters: { visible: boolean };
  spread: { visible: boolean };
  weather: Partial<Record<string, { visible?: boolean } | undefined>>;
  incidentMap: { mapId: string | null; series: string | null };
}

export function fireReadyNeeds(layers: FireReadyLayers): FireReadyNeed[] {
  const needs: FireReadyNeed[] = [];
  const weatherOn = Object.values(layers.weather).some((p) => p?.visible);
  if (weatherOn) needs.push('weather');
  if (layers.spread.visible) needs.push('forecast');
  if (layers.incidentMap.mapId || layers.incidentMap.series) needs.push('sheet');
  if (needs.length === 0 && layers.perimeters.visible) needs.push('perimeter');
  return needs;
}

export function isFireViewReady(args: {
  needs: FireReadyNeed[];
  perimeterLanded: boolean;
  weatherLanded: boolean;
  forecastLanded: boolean;
  sheetLanded: boolean;
}): boolean {
  return args.needs.every((need) => {
    if (need === 'perimeter') return args.perimeterLanded;
    if (need === 'weather') return args.weatherLanded;
    if (need === 'forecast') return args.forecastLanded;
    return args.sheetLanded;
  });
}
