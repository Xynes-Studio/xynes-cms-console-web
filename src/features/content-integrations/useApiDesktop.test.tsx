import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useApiDesktop } from "./useApiDesktop";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("subscribes to the editor breakpoint, responds to changes and cleans up", () => {
  let matches = false;
  let changed: (() => void) | undefined;
  const remove = vi.fn();
  const media = {
    get matches() {
      return matches;
    },
    addEventListener: vi.fn((_event, callback: () => void) => {
      changed = callback;
    }),
    removeEventListener: remove,
  };
  const match = vi.fn(() => media);
  vi.stubGlobal("matchMedia", match);
  const { result, unmount } = renderHook(useApiDesktop);
  expect(result.current).toBe(false);
  expect(match).toHaveBeenCalledWith("(min-width: 768px)");
  act(() => {
    matches = true;
    changed?.();
  });
  expect(result.current).toBe(true);
  unmount();
  expect(remove).toHaveBeenCalledWith("change", changed);
});
it("uses a right-sheet default during server rendering", () => {
  function Server() {
    return <span>{String(useApiDesktop())}</span>;
  }
  expect(renderToString(<Server />)).toContain("true");
});
