import { describe, expect, it } from "vitest";
import {
  createContentToolbarScrollState,
  resolveContentToolbarScrollState,
} from "./content-toolbar-scroll-stack";

describe("content-toolbar-scroll-stack", () => {
  it("keeps the secondary toolbar visible when the results area does not overflow", () => {
    const nextState = resolveContentToolbarScrollState({
      state: {
        ...createContentToolbarScrollState(),
        isSecondaryToolbarVisible: false,
      },
      scrollTop: 120,
      scrollHeight: 320,
      clientHeight: 600,
    });

    expect(nextState.isSecondaryToolbarVisible).toBe(true);
    expect(nextState.lastScrollTop).toBe(120);
  });

  it("hides the secondary toolbar after accumulated downward movement crosses the threshold", () => {
    const partiallyScrolledState = resolveContentToolbarScrollState({
      state: createContentToolbarScrollState(),
      scrollTop: 20,
      scrollHeight: 1600,
      clientHeight: 600,
    });
    const hiddenState = resolveContentToolbarScrollState({
      state: partiallyScrolledState,
      scrollTop: 24,
      scrollHeight: 1600,
      clientHeight: 600,
    });

    expect(partiallyScrolledState.isSecondaryToolbarVisible).toBe(true);
    expect(hiddenState.isSecondaryToolbarVisible).toBe(false);
  });

  it("reopens the secondary toolbar after a small upward movement once hidden", () => {
    const nextState = resolveContentToolbarScrollState({
      state: {
        isSecondaryToolbarVisible: false,
        lastScrollTop: 24,
        downwardScrollAccumulator: 0,
        upwardScrollAccumulator: 0,
      },
      scrollTop: 20,
      scrollHeight: 1600,
      clientHeight: 600,
    });

    expect(nextState.isSecondaryToolbarVisible).toBe(true);
    expect(nextState.upwardScrollAccumulator).toBe(0);
  });

  it("resets the secondary toolbar to visible near the top of the results area", () => {
    const nextState = resolveContentToolbarScrollState({
      state: {
        isSecondaryToolbarVisible: false,
        lastScrollTop: 64,
        downwardScrollAccumulator: 0,
        upwardScrollAccumulator: 0,
      },
      scrollTop: 12,
      scrollHeight: 1600,
      clientHeight: 600,
    });

    expect(nextState.isSecondaryToolbarVisible).toBe(true);
    expect(nextState.lastScrollTop).toBe(12);
  });

  it("ignores near-zero scroll jitter", () => {
    const initialState = {
      ...createContentToolbarScrollState(24),
      downwardScrollAccumulator: 8,
    };
    const nextState = resolveContentToolbarScrollState({
      state: initialState,
      scrollTop: 24.5,
      scrollHeight: 1600,
      clientHeight: 600,
    });

    expect(nextState.isSecondaryToolbarVisible).toBe(true);
    expect(nextState.downwardScrollAccumulator).toBe(8);
    expect(nextState.lastScrollTop).toBe(24.5);
  });
});
