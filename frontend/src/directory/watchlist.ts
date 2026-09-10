/**
 * The watchlist: cornea ids the user starred in the directory. Persisted the
 * same way the draw annotations are — one localStorage key on this device,
 * nothing uploaded, nothing tied to an account.
 *
 * The set is small (a handful of fires) so it is written whole on every
 * toggle; storage being full or blocked degrades to a session-only list.
 */

export const WATCHLIST_KEY = 'rd-watchlist';

/** Read the starred set. Anything unparseable reads as empty. */
export function loadWatchlist(): Set<string> {
  // Everything inside the try: even `typeof localStorage` can throw when the
  // browser blocks storage access (sandboxed frames, cookie blocking).
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && !!id));
  } catch {
    return new Set();
  }
}

export function saveWatchlist(ids: ReadonlySet<string>): void {
  try {
    if (ids.size) localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...ids]));
    else localStorage.removeItem(WATCHLIST_KEY);
  } catch {
    /* storage full/blocked — the watchlist stays session-only */
  }
}

/** Toggle one id, returning a NEW set (store state must not be mutated). */
export function toggleWatched(ids: ReadonlySet<string>, corneaId: string): Set<string> {
  const next = new Set(ids);
  if (!next.delete(corneaId)) next.add(corneaId);
  return next;
}
