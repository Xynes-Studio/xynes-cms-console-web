"use client";

import { useCallback, useRef, useState } from "react";
import { buildIntegrationRequest } from "./build-request";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import { buildRequestSnippets } from "./snippets";
import type {
  DeliveryField,
  IntegrationContext,
  RequestSnippets,
} from "./types";

export type IntegrationTab = "customize" | "rest" | "scripts" | "sdk";
export type CodeFormat = keyof RequestSnippets;
export type IntegrationControls = {
  sortBy: "publishedAt" | "title";
  sortDirection: "asc" | "desc";
  limit: string;
  offset: string;
  search: string;
  fields: readonly DeliveryField[];
};
type CopyStatus = "idle" | "pending" | "copied" | "manual";
type Session = {
  identity: string;
  generation: symbol;
  revision: number;
  controls: IntegrationControls;
  tab: IntegrationTab;
  format: CodeFormat;
  copyStatus: CopyStatus;
};
function newSession(identity: string, context: IntegrationContext): Session {
  const directory = DELIVERY_CONTRACT.operations.directory;
  return {
    identity,
    generation: Symbol(),
    revision: 0,
    tab: "customize",
    format: "curl",
    copyStatus: "idle",
    controls: {
      sortBy: directory.defaultSortBy,
      sortDirection: directory.defaultSortDirection,
      limit: String(directory.limit.default),
      offset: String(directory.offset.default),
      search: "",
      fields: DELIVERY_CONTRACT.operations[context.target.kind].fields,
    },
  };
}
const numericInput = (value: string) =>
  value.trim() === "" ? NaN : Number(value);

// Clipboard operations belong to the browser, so serialization must survive
// a workbench unmount/reopen and also cover independently mounted hosts.
let activeClipboardWrite: Promise<void> | undefined;
function serializeClipboardWrite(write: () => Promise<void>): Promise<void> {
  const pending = activeClipboardWrite
    ? activeClipboardWrite.then(write, write)
    : write();
  activeClipboardWrite = pending;
  const release = () => {
    if (activeClipboardWrite === pending) activeClipboardWrite = undefined;
  };
  // Rejection releases the queue and does not prevent the next requested copy.
  void pending.then(release, release);
  return pending;
}

/** Ephemeral state only. Generating examples never contacts a service or accepts a key. */
export function useContentIntegration(context: IntegrationContext) {
  const target = context.target;
  // Config changes also invalidate a pending copy, even when the resource is unchanged.
  const identity = JSON.stringify([
    context.workspaceId,
    target.kind,
    target.kind === "directory" ? target.directoryId : target.entryId,
    context.workspaceSlug,
    context.apiBaseUrl,
  ]);
  const writeInFlight = useRef(false);
  const [copyPending, setCopyPending] = useState(false);
  const [session, setSession] = useState(() => newSession(identity, context));
  let current = session;
  if (session.identity !== identity) {
    current = newSession(identity, context);
    setSession(current);
  }
  const { controls, format, tab, copyStatus } = current;
  const options =
    target.kind === "directory"
      ? {
          fields: controls.fields,
          sortBy: controls.sortBy,
          sortDirection: controls.sortDirection,
          limit: numericInput(controls.limit),
          offset: numericInput(controls.offset),
          ...(controls.search.trim() ? { search: controls.search.trim() } : {}),
        }
      : { fields: controls.fields };
  const result = buildIntegrationRequest(context, options);
  const snippet = result.ok
    ? buildRequestSnippets(result.request)[format]
    : undefined;

  function updateControls(patch: Partial<IntegrationControls>) {
    setSession((previous) => ({
      ...previous,
      controls: { ...previous.controls, ...patch },
      revision: previous.revision + 1,
      copyStatus: "idle",
    }));
  }
  function setFormat(next: CodeFormat) {
    setSession((previous) => ({
      ...previous,
      format: next,
      revision: previous.revision + 1,
      copyStatus: "idle",
    }));
  }
  const setTab = useCallback((next: string) => {
    if (
      next !== "customize" &&
      next !== "rest" &&
      next !== "scripts" &&
      next !== "sdk"
    )
      return;
    setSession((previous) => ({ ...previous, tab: next }));
  }, []);
  async function copy() {
    if (snippet === undefined || writeInFlight.current) return;
    writeInFlight.current = true;
    setCopyPending(true);
    const copySession = current;
    const complete = (status: CopyStatus) =>
      setSession((previous) =>
        previous.generation === copySession.generation &&
        previous.revision === copySession.revision
          ? { ...previous, copyStatus: status }
          : previous,
      );
    complete("pending");
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        complete("manual");
        return;
      }
      await serializeClipboardWrite(() => navigator.clipboard.writeText(snippet));
      complete("copied");
    } catch {
      complete("manual");
    } finally {
      writeInFlight.current = false;
      setCopyPending(false);
    }
  }
  return {
    controls,
    result,
    snippet,
    tab,
    format,
    copyStatus,
    copyPending,
    updateControls,
    setFormat,
    setTab,
    copy,
  };
}
export type ContentIntegrationController = ReturnType<
  typeof useContentIntegration
>;
