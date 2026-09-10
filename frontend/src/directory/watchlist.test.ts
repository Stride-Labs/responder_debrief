import { beforeEach, describe, expect, it } from 'vitest';
import { WATCHLIST_KEY, loadWatchlist, saveWatchlist, toggleWatched } from './watchlist';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('watchlist persistence', () => {
  beforeEach(() => store.clear());

  it('round-trips a starred set', () => {
    saveWatchlist(new Set(['a', 'b']));
    expect([...loadWatchlist()].sort()).toEqual(['a', 'b']);
  });

  it('drops the key entirely once the last star is removed', () => {
    saveWatchlist(new Set(['a']));
    saveWatchlist(new Set());
    expect(store.has(WATCHLIST_KEY)).toBe(false);
    expect(loadWatchlist().size).toBe(0);
  });

  it('reads garbage as an empty list rather than throwing', () => {
    store.set(WATCHLIST_KEY, '{oops');
    expect(loadWatchlist().size).toBe(0);
    store.set(WATCHLIST_KEY, '{"a":1}');
    expect(loadWatchlist().size).toBe(0);
    store.set(WATCHLIST_KEY, '["a", 7, "", "b"]');
    expect([...loadWatchlist()]).toEqual(['a', 'b']);
  });

  it('toggle adds, removes, and never mutates the set it was given', () => {
    const a = new Set(['x']);
    const b = toggleWatched(a, 'y');
    expect([...b]).toEqual(['x', 'y']);
    expect([...a]).toEqual(['x']);
    expect([...toggleWatched(b, 'x')]).toEqual(['y']);
  });
});
