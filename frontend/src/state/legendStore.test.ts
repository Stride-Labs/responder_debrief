import { beforeEach, describe, expect, it } from 'vitest';

// The store reads document.documentElement.dataset.theme at module load;
// these tests run in node, so give it the minimum it touches.
(globalThis as { document?: unknown }).document ??= {
  documentElement: { dataset: {} },
};
(globalThis as { window?: unknown }).window ??= globalThis;
(globalThis as { localStorage?: unknown }).localStorage ??= {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
const { useStore } = await import('./store');
const initialCollapsed = useStore.getState().ui.legendCollapsed;

describe('legendCollapsed slice', () => {
  beforeEach(() => {
    useStore.getState().actions.setLegendCollapsed(false);
  });

  it('defaults to open', () => {
    expect(initialCollapsed).toBe(false);
  });

  it('setLegendCollapsed flips the flag', () => {
    const { actions } = useStore.getState();
    actions.setLegendCollapsed(true);
    expect(useStore.getState().ui.legendCollapsed).toBe(true);
    actions.setLegendCollapsed(false);
    expect(useStore.getState().ui.legendCollapsed).toBe(false);
  });

  it('selectFire does not reset the fold', () => {
    const { actions } = useStore.getState();
    actions.setLegendCollapsed(true);
    actions.selectFire('any-id');
    expect(useStore.getState().ui.legendCollapsed).toBe(true);
  });
});
