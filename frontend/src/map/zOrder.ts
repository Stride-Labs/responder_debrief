/**
 * Canonical z-order for all rd- layers. Rasters slot below the basemap's
 * first symbol (label) layer so roads/places stay legible; vectors and pins
 * ride on top. The two groups are separate arrays rather than one array with
 * a marker index, so a layer can never drift to the wrong side of the seam.
 */
import type { Map as MlMap } from 'maplibre-gl';

/**
 * Rasters, bottom → top — the whole group sits below the basemap labels.
 *
 * Weather rides ABOVE the incident-map sheet and the spread forecast: a
 * scanned map sheet at full opacity would otherwise erase the smoke/RH wash
 * underneath it, and the wash is the thing the responder came to read.
 */
const BELOW_LABEL_ORDER = [
  'rd-incident-map',
  'rd-spread-forecast',
  'rd-weather-tmpf-a', 'rd-weather-tmpf-b',
  'rd-weather-rh-a', 'rd-weather-rh-b',
  'rd-weather-ws-a', 'rd-weather-ws-b',
  'rd-weather-wg-a', 'rd-weather-wg-b',
  'rd-weather-wd-a', 'rd-weather-wd-b',
  'rd-weather-ffwi-a', 'rd-weather-ffwi-b',
  'rd-weather-smoke-a', 'rd-weather-smoke-b',
  'rd-weather-tcdc-a', 'rd-weather-tcdc-b',
  'rd-weather-pign-a', 'rd-weather-pign-b',
  'rd-weather-meq-a', 'rd-weather-meq-b',
  'rd-weather-apcp01-a', 'rd-weather-apcp01-b',
  'rd-weather-apcptot-a', 'rd-weather-apcptot-b',
  'rd-traffic', // thin congestion lines — stay legible through a weather wash
  'rd-national-perimeters',
] as const;

/** Vectors, bottom → top — the whole group sits above the basemap labels. */
const ABOVE_LABEL_ORDER = [
  'rd-wind-arrows', // over the weather rasters + labels, under perimeters/pins
  'rd-range-fill',
  'rd-range-line',
  'rd-incidents-line',
  'rd-incidents-pt',
  'rd-hist-perims-fill',
  'rd-hist-perims-line',
  'rd-ir-heat-fill',
  'rd-ir-heat-line',
  'rd-ir-heat-pt',
  'rd-perimeter-fill',
  'rd-perimeter-line',
  'rd-hotspots',
  'rd-fire-pins',
  // user annotations (Draw tab) ride above every data layer
  'rd-draw-line',
  'rd-draw-line-dash',
  'rd-draw-line-dots',
  'rd-draw-line-hatch',
  'rd-draw-line-letter',
  'rd-draw-pt',
  'rd-draw-label',
  // directions ride on the very top
  'rd-route-casing',
  'rd-route-line',
] as const;

/** Bottom → top. Layer ids owned by our layer managers (prefix rd-). */
export const RD_LAYER_ORDER = [...BELOW_LABEL_ORDER, ...ABOVE_LABEL_ORDER] as const;

export type RdLayerId = (typeof RD_LAYER_ORDER)[number];

/** Ids that must be inserted BELOW the first basemap symbol layer. */
const BELOW_LABELS = new Set<string>(BELOW_LABEL_ORDER);

export function firstSymbolLayerId(map: MlMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((l) => l.type === 'symbol' && !l.id.startsWith('rd-'))?.id;
}

/**
 * beforeId to use when adding an rd- layer so it lands in canonical position.
 * Below-label rasters cap at the first basemap symbol layer; above-label
 * vectors cap at the map top.
 */
export function beforeIdFor(map: MlMap, id: RdLayerId): string | undefined {
  const idx = RD_LAYER_ORDER.indexOf(id);
  const groupEnd = BELOW_LABELS.has(id) ? BELOW_LABEL_ORDER.length : RD_LAYER_ORDER.length;
  for (let i = idx + 1; i < groupEnd; i++) {
    if (map.getLayer(RD_LAYER_ORDER[i])) return RD_LAYER_ORDER[i];
  }
  if (BELOW_LABELS.has(id)) return firstSymbolLayerId(map);
  return undefined;
}

/** Re-assert canonical order (after style swaps or out-of-order adds). */
export function ensureOrder(map: MlMap): void {
  const symbolId = firstSymbolLayerId(map);
  const ids = RD_LAYER_ORDER.filter((id) => map.getLayer(id));
  // Place top→bottom within each group so every move targets a settled layer.
  let prevAbove: string | undefined;
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    if (BELOW_LABELS.has(id)) continue;
    map.moveLayer(id, prevAbove);
    prevAbove = id;
  }
  let prevBelow = symbolId;
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    if (!BELOW_LABELS.has(id)) continue;
    map.moveLayer(id, prevBelow);
    prevBelow = id;
  }
}
