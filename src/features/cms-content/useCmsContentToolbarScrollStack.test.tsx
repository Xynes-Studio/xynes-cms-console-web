import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCmsContentToolbarScrollStack } from "./useCmsContentToolbarScrollStack";

const toolbarRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 320,
  bottom: 48,
  width: 320,
  height: 48,
  toJSON: () => ({}),
};

const observe = vi.fn();
const disconnect = vi.fn();
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
let resizeCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  observe = observe;
  disconnect = disconnect;

  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
}

function HookHarness({ resetKeys }: { resetKeys: readonly unknown[] }) {
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const secondaryToolbarRowRef = useRef<HTMLDivElement | null>(null);
  const scrollStack = useCmsContentToolbarScrollStack({
    resetKeys,
    secondaryToolbarRowRef,
  });

  return (
    <>
      <div data-testid="toolbar-row" ref={secondaryToolbarRowRef} />
      <div data-testid="results" ref={resultsScrollRef} onScroll={scrollStack.handleResultsScroll} />
      <span data-testid="visible">
        {String(scrollStack.isSecondaryToolbarVisible)}
      </span>
      <span data-testid="max-height">
        {String(scrollStack.secondaryToolbarContainerStyle?.maxHeight ?? "")}
      </span>
    </>
  );
}

describe("useCmsContentToolbarScrollStack", () => {
  beforeEach(() => {
    observe.mockReset();
    disconnect.mockReset();
    resizeCallback = null;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    HTMLElement.prototype.getBoundingClientRect = () => toolbarRect;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("measures the secondary toolbar height and disconnects the ResizeObserver on unmount", () => {
    const view = render(<HookHarness resetKeys={["initial"]} />);

    expect(screen.getByTestId("visible")).toHaveTextContent("true");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48px");
    expect(observe).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the last positive toolbar height when a clipped resize reports zero", () => {
    render(<HookHarness resetKeys={["initial"]} />);

    expect(screen.getByTestId("max-height")).toHaveTextContent("48px");

    HTMLElement.prototype.getBoundingClientRect = () => ({
      ...toolbarRect,
      bottom: 0,
      height: 0,
    });
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(screen.getByTestId("max-height")).toHaveTextContent("48px");
  });

  it("resets the hidden toolbar back to visible when the reset token changes", () => {
    const view = render(<HookHarness resetKeys={["initial"]} />);
    const resultsScrollRegion = screen.getByTestId("results");

    Object.defineProperty(resultsScrollRegion, "scrollHeight", {
      value: 1600,
      configurable: true,
    });
    Object.defineProperty(resultsScrollRegion, "clientHeight", {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(resultsScrollRegion, "scrollTop", {
      value: 24,
      writable: true,
      configurable: true,
    });

    fireEvent.scroll(resultsScrollRegion);

    expect(screen.getByTestId("visible")).toHaveTextContent("false");
    expect(screen.getByTestId("max-height")).toHaveTextContent("0px");

    view.rerender(<HookHarness resetKeys={["next"]} />);

    expect(screen.getByTestId("visible")).toHaveTextContent("true");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48px");

    resultsScrollRegion.scrollTop = 30;
    fireEvent.scroll(resultsScrollRegion);

    expect(screen.getByTestId("visible")).toHaveTextContent("true");
  });

  it("BUG-006: remains hidden when a bottom scroll is clamped by the taller results viewport", () => {
    render(<HookHarness resetKeys={["initial"]} />);
    const resultsScrollRegion = screen.getByTestId("results");

    Object.defineProperty(resultsScrollRegion, "scrollHeight", {
      value: 1600,
      configurable: true,
    });
    Object.defineProperty(resultsScrollRegion, "clientHeight", {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(resultsScrollRegion, "scrollTop", {
      value: 1000,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(resultsScrollRegion);
    expect(screen.getByTestId("visible")).toHaveTextContent("false");

    Object.defineProperty(resultsScrollRegion, "clientHeight", {
      value: 648,
      configurable: true,
    });
    resultsScrollRegion.scrollTop = 952;
    fireEvent.scroll(resultsScrollRegion);
    expect(screen.getByTestId("visible")).toHaveTextContent("false");

    resultsScrollRegion.scrollTop = 948;
    fireEvent.scroll(resultsScrollRegion);
    expect(screen.getByTestId("visible")).toHaveTextContent("true");
  });
});
