"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type UIEvent,
} from "react";
import {
  createContentToolbarScrollState,
  resolveContentToolbarScrollState,
} from "./content-toolbar-scroll-stack";

export function useCmsContentToolbarScrollStack({
  resetKeys,
  secondaryToolbarRowRef,
}: {
  resetKeys: readonly unknown[];
  secondaryToolbarRowRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const [isSecondaryToolbarVisible, setIsSecondaryToolbarVisible] =
    useState(true);
  const [secondaryToolbarHeight, setSecondaryToolbarHeight] = useState(0);
  const [scrollStateRef] = useState(() => ({
    current: createContentToolbarScrollState(),
  }));

  const resetToken = resetKeys
    .map((key) => {
      if (
        typeof key === "string" ||
        typeof key === "number" ||
        typeof key === "boolean"
      ) {
        return String(key);
      }

      return JSON.stringify(key);
    })
    .join("|");
  const [appliedResetToken, setAppliedResetToken] = useState(resetToken);

  useLayoutEffect(() => {
    const node = secondaryToolbarRowRef.current;
    if (!node) {
      return;
    }

    const updateHeight = () => {
      setSecondaryToolbarHeight(node.getBoundingClientRect().height);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [secondaryToolbarRowRef]);

  const handleResultsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (appliedResetToken !== resetToken) {
      scrollStateRef.current = createContentToolbarScrollState(
        Math.max(event.currentTarget.scrollTop, 0),
      );
      setAppliedResetToken(resetToken);

      if (!isSecondaryToolbarVisible) {
        setIsSecondaryToolbarVisible(true);
      }

      return;
    }

    const nextState = resolveContentToolbarScrollState({
      state: scrollStateRef.current,
      scrollTop: event.currentTarget.scrollTop,
      scrollHeight: event.currentTarget.scrollHeight,
      clientHeight: event.currentTarget.clientHeight,
    });

    if (
      nextState.isSecondaryToolbarVisible !==
      scrollStateRef.current.isSecondaryToolbarVisible
    ) {
      scrollStateRef.current = nextState;
      setIsSecondaryToolbarVisible(nextState.isSecondaryToolbarVisible);
      return;
    }

    scrollStateRef.current = nextState;
  }, [appliedResetToken, isSecondaryToolbarVisible, resetToken, scrollStateRef]);

  const isSecondaryToolbarVisibleEffective =
    appliedResetToken !== resetToken ? true : isSecondaryToolbarVisible;

  const secondaryToolbarContainerStyle: CSSProperties | undefined =
    isSecondaryToolbarVisibleEffective || secondaryToolbarHeight === 0
      ? secondaryToolbarHeight > 0
        ? { maxHeight: `${secondaryToolbarHeight}px` }
        : undefined
      : { maxHeight: "0px" };

  return {
    isSecondaryToolbarVisible: isSecondaryToolbarVisibleEffective,
    secondaryToolbarContainerStyle,
    handleResultsScroll,
  };
}
