/**
 * Diffalo waits on `rd-fire-ready` until the fire view has SETTLED: every
 * layer the seed turned on has either painted, or definitively cannot paint
 * from the data we have (catalog loaded but the run/product/sheet is absent,
 * or the download failed and the layer hid itself). "Settled" — not
 * "painted" — is the invariant that keeps the marker guaranteed to mount:
 * a predicate that only accepts the painted state hangs forever the moment
 * a seeded layer's data is missing, and no recording timeout fixes that.
 *
 * Still-loading states (catalog query in flight, archive downloading,
 * tiles streaming) stay unsettled, so the marker never mounts early on a
 * view that is about to change.
 *
 * The per-layer settle logic lives next to each layer manager
 * (isWeatherSettled / isForecastSettled / isIncidentMapSettled); this module
 * just combines the signals. Shell-only (`ready=shell`) never reaches this.
 */
export interface FireReadySignals {
  perimeter: boolean;
  weather: boolean;
  forecast: boolean;
  sheet: boolean;
}

export function isFireViewReady(s: FireReadySignals): boolean {
  return s.perimeter && s.weather && s.forecast && s.sheet;
}

/**
 * Perimeter settle: nothing to wait for when the layer is off; pending until
 * the version index query resolves; then either there is no version to draw
 * (settled — some fires have no perimeter yet) or the feature must land.
 */
export function isPerimeterSettled(args: {
  visible: boolean;
  indexLoaded: boolean;
  hasVersion: boolean;
  featureLanded: boolean;
}): boolean {
  if (!args.visible) return true;
  if (!args.indexLoaded) return false;
  if (!args.hasVersion) return true;
  return args.featureLanded;
}
