"use client";
import { useEffect, useRef, useState } from "react";
import type { IntegrationContext } from "./types";
export function useIntegrationDialog(scope: string, enabled: boolean) {
  const key = JSON.stringify([scope, enabled]);
  const [session, setSession] = useState<{
    key: string;
    context: IntegrationContext | null;
  }>({ key, context: null });
  const focusReturn = useRef<(() => void) | null>(null);
  let current = session;
  if (session.key !== key) {
    current = { key, context: null };
    setSession(current);
  }
  useEffect(
    () => () => {
      focusReturn.current = null;
    },
    [key],
  );
  function open(
    context: IntegrationContext,
    focus?: HTMLElement | null | (() => void),
  ) {
    if (!enabled) return;
    focusReturn.current =
      typeof focus === "function"
        ? focus
        : focus
          ? () => {
              if (focus.isConnected) focus.focus();
            }
          : null;
    setSession({ key, context });
  }
  function close() {
    setSession({ key, context: null });
  }
  function restoreFocus() {
    const restore = focusReturn.current;
    focusReturn.current = null;
    restore?.();
  }
  return {
    context: enabled ? current.context : null,
    open,
    close,
    restoreFocus,
  };
}
