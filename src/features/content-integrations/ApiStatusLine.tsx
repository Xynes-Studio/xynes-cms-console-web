"use client";

import { Alert } from "@lumia-ui/components";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { IntegrationContext } from "./types";

/** Publication metadata is guidance; this does not execute a delivery request. */
export function integrationAvailability(context: IntegrationContext) {
  if (context.deliveryState === "republish_required") return "legacy";
  if (context.publicationState === "archived") return "archived";
  if (
    context.publicationState === "draft" ||
    context.publicationState === "scheduled" ||
    context.deliveryState === "unpublished"
  )
    return "unpublished";
  if (context.deliveryState !== "available") return "unknown";
  return context.publicationState === "published-with-changes"
    ? "changes"
    : "published";
}

const presentation = {
  published: { variant: "success", icon: "circle-check" },
  changes: { variant: "warning", icon: "republish" },
  unpublished: { variant: "info", icon: "info" },
  archived: { variant: "warning", icon: "alert" },
  legacy: { variant: "warning", icon: "republish" },
  unknown: { variant: "info", icon: "info" },
  folder: { variant: "info", icon: "info" },
} as const;

export function ApiStatusLine({ context }: { context: IntegrationContext }) {
  const t = useTranslations("cms.contentIntegrations");
  const state =
    context.target.kind === "directory"
      ? "folder"
      : integrationAvailability(context);
  const [announce, setAnnounce] = useState(true);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    // One initial painted announcement; later renders are ordinary readable copy.
    const frame = window.requestAnimationFrame(() => {
      if (mounted.current) setAnnounce(false);
    });
    return () => {
      mounted.current = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <Alert
      {...presentation[state]}
      role={announce ? "status" : "group"}
      aria-live={announce ? "polite" : "off"}
    >
      <p>{t(`status.${state}`)}</p>
    </Alert>
  );
}
