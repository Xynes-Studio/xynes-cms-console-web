export const SCROLL_HIDE_ACCUMULATED_DELTA_PX = 24;
export const SCROLL_REVEAL_ACCUMULATED_DELTA_PX = 4;
export const SCROLL_NOISE_FLOOR_PX = 1;
export const SCROLL_REVEAL_TOP_PX = 16;

export type ContentToolbarScrollState = {
  isSecondaryToolbarVisible: boolean;
  lastScrollTop: number;
  downwardScrollAccumulator: number;
  upwardScrollAccumulator: number;
};

export function createContentToolbarScrollState(
  lastScrollTop = 0,
): ContentToolbarScrollState {
  return {
    isSecondaryToolbarVisible: true,
    lastScrollTop,
    downwardScrollAccumulator: 0,
    upwardScrollAccumulator: 0,
  };
}

export function resolveContentToolbarScrollState({
  state,
  scrollTop,
  scrollHeight,
  clientHeight,
}: {
  state: ContentToolbarScrollState;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): ContentToolbarScrollState {
  const nextScrollTop = Math.max(scrollTop, 0);
  const scrollDelta = nextScrollTop - state.lastScrollTop;

  if (scrollHeight <= clientHeight + SCROLL_NOISE_FLOOR_PX) {
    return createContentToolbarScrollState(nextScrollTop);
  }

  if (nextScrollTop <= SCROLL_REVEAL_TOP_PX) {
    return createContentToolbarScrollState(nextScrollTop);
  }

  if (Math.abs(scrollDelta) < SCROLL_NOISE_FLOOR_PX) {
    return {
      ...state,
      lastScrollTop: nextScrollTop,
    };
  }

  if (scrollDelta > 0) {
    const downwardScrollAccumulator =
      state.downwardScrollAccumulator + scrollDelta;
    const shouldHide =
      state.isSecondaryToolbarVisible &&
      downwardScrollAccumulator >= SCROLL_HIDE_ACCUMULATED_DELTA_PX;

    return {
      isSecondaryToolbarVisible: shouldHide
        ? false
        : state.isSecondaryToolbarVisible,
      lastScrollTop: nextScrollTop,
      downwardScrollAccumulator: shouldHide ? 0 : downwardScrollAccumulator,
      upwardScrollAccumulator: 0,
    };
  }

  const upwardScrollAccumulator =
    state.upwardScrollAccumulator + Math.abs(scrollDelta);
  const shouldReveal =
    !state.isSecondaryToolbarVisible &&
    upwardScrollAccumulator >= SCROLL_REVEAL_ACCUMULATED_DELTA_PX;

  return {
    isSecondaryToolbarVisible: shouldReveal
      ? true
      : state.isSecondaryToolbarVisible,
    lastScrollTop: nextScrollTop,
    downwardScrollAccumulator: 0,
    upwardScrollAccumulator: shouldReveal ? 0 : upwardScrollAccumulator,
  };
}
