"use client";
import { useSyncExternalStore } from "react";
const query = "(min-width: 768px)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
/** SSR starts with a right sheet; the browser applies the same editor breakpoint. */
export function useApiDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
