"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseCmsContentQueryState,
  serializeCmsContentQueryState,
  type CmsContentQueryState,
} from "./cms-content-query-state";

export type {
  CmsContentQueryState,
  CmsContentView,
} from "./cms-content-query-state";

export type CmsContentQueryUpdateOptions = {
  navigation?: "push" | "replace";
};

export function useCmsContentQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<CmsContentQueryState>(
    () => parseCmsContentQueryState(searchParams),
    [searchParams],
  );

  const setState = useCallback(
    (
      patch: Partial<CmsContentQueryState>,
      options?: CmsContentQueryUpdateOptions,
    ) => {
      const nextState: CmsContentQueryState = {
        ...state,
        ...patch,
      };

      const params = serializeCmsContentQueryState(nextState);
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentQueryString = searchParams.toString();
      const currentUrl = currentQueryString
        ? `${pathname}?${currentQueryString}`
        : pathname;

      if (nextUrl === currentUrl) {
        return;
      }

      if (options?.navigation === "replace") {
        router.replace(nextUrl);
        return;
      }

      router.push(nextUrl);
    },
    [pathname, router, searchParams, state],
  );

  return {
    state,
    setState,
  };
}
