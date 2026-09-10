/**
 * Georeferenced incident-map (GeoPDF) tile overlay. Exclusive: at most one
 * manifest entry is shown, chosen by ctx.layers.incidentMap.mapId. The
 * source is recreated on mapId change (tile URLs/zooms/bounds all differ).
 */
import type { Map as MlMap, MapSourceDataEvent } from 'maplibre-gl';
import { dataUrl } from '../../api/catalogs';
import type { IncidentMapEntry } from '../../api/types';
import { beforeIdFor } from '../zOrder';
import type { LayerManager } from '../layerTypes';
import { resolveSeriesVersion, seriesVersions } from '../../utils/incidentMaps';

const SRC = 'rd-incident-map';
const LYR = 'rd-incident-map';

let lastKey: string | null = null; // `${mapId}@${rev}` of the source on the map
let loadedKey: string | null = null; // lastKey once its tiles finished loading
let lastOpacity: number | null = null;
let onSourceData: ((e: MapSourceDataEvent) => void) | null = null;

function removeAll(map: MlMap): void {
  if (map.getLayer(LYR)) map.removeLayer(LYR);
  if (map.getSource(SRC)) map.removeSource(SRC);
  lastKey = null;
  loadedKey = null;
  lastOpacity = null;
}

function findEntry(ctx: { incidentManifest?: { maps: IncidentMapEntry[] } | undefined }, mapId: string) {
  return ctx.incidentManifest?.maps.find((m) => m.id === mapId && m.tiles != null) ?? null;
}

function resolveEntry(
  ctx: { incidentManifest?: { maps: IncidentMapEntry[] } | undefined; currentTime?: number },
  mapId: string | null,
  series: string | null,
): IncidentMapEntry | null {
  if (series) {
    return resolveSeriesVersion(
      seriesVersions(ctx.incidentManifest?.maps ?? [], series),
      ctx.currentTime ?? 0,
    );
  }
  return mapId ? findEntry(ctx, mapId) : null;
}

/**
 * True when the pinned sheet (or series version) has SETTLED: its tiles
 * finished loading into the viewport, or it definitively cannot show — the
 * manifest loaded and the entry (or its tiles) is absent, so update()
 * removes the layer and nothing more will happen. Only "still deciding"
 * states return false: the manifest query in flight, or tiles streaming.
 */
export function isIncidentMapSettled(
  ctx: {
    layers: { incidentMap: { mapId: string | null; series: string | null } };
    incidentManifest?: { maps: IncidentMapEntry[] } | undefined;
    currentTime: number;
  },
  manifestLoaded: boolean,
): boolean {
  const { mapId, series } = ctx.layers.incidentMap;
  if (!mapId && !series) return true;
  if (!manifestLoaded) return false;
  const entry = resolveEntry(ctx, mapId, series);
  if (!entry?.tiles) return true; // not in the manifest — nothing to show
  return loadedKey === `${entry.id}@${entry.rev}`;
}

export const incidentMapLayer: LayerManager = {
  mount(map) {
    lastKey = null;
    loadedKey = null;
    lastOpacity = null;
    // Track when the raster source's tiles finish loading for the current
    // viewport — "source added" is not "sheet on screen", and the ready
    // marker must not mount while the sheet is still streaming in.
    onSourceData = (e) => {
      if (e.sourceId !== SRC || !e.isSourceLoaded) return;
      loadedKey = lastKey;
    };
    map.on('sourcedata', onSourceData);
    // Created lazily when a map is selected.
  },

  update(map, ctx) {
    const { mapId, series } = ctx.layers.incidentMap;
    const entry = resolveEntry(ctx, mapId, series);
    const tiles = entry?.tiles ?? null;

    if (!entry || !tiles) {
      removeAll(map);
      return;
    }

    const key = `${entry.id}@${entry.rev}`;
    if (key !== lastKey || !map.getSource(SRC)) {
      removeAll(map);
      map.addSource(SRC, {
        type: 'raster',
        tiles: [dataUrl(tiles.url_template)],
        // gdal2tiles emits 256px tiles; MapLibre's default is 512, which
        // fetches one zoom level coarser than the screen needs and stretches
        // it 2x — declaring the real size recovers a full level of sharpness.
        tileSize: 256,
        minzoom: tiles.minzoom,
        maxzoom: tiles.maxzoom,
        bounds: tiles.bounds,
      });
      lastKey = key;
    }
    if (!map.getLayer(LYR)) {
      map.addLayer(
        {
          id: LYR,
          type: 'raster',
          source: SRC,
          paint: { 'raster-opacity': ctx.layers.incidentMap.opacity },
        },
        beforeIdFor(map, 'rd-incident-map'),
      );
      lastOpacity = ctx.layers.incidentMap.opacity;
    }

    if (ctx.layers.incidentMap.opacity !== lastOpacity) {
      lastOpacity = ctx.layers.incidentMap.opacity;
      map.setPaintProperty(LYR, 'raster-opacity', lastOpacity);
    }
  },

  unmount(map) {
    if (onSourceData) {
      map.off('sourcedata', onSourceData);
      onSourceData = null;
    }
    removeAll(map);
  },
};
