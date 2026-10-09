"use client";

import { useEffect, useRef, useState } from "react";
import { buildIntegrationRequest } from "./build-request";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import { buildRequestSnippets } from "./snippets";
import { DirectoryOptionsSchema } from "./resource-adapters";
import type {
  DeliveryField,
  IntegrationContext,
  RequestSnippets,
} from "./types";

export type CodeFormat = keyof RequestSnippets;
export type IntegrationControls = {
  sortBy: "publishedAt" | "title";
  sortDirection: "asc" | "desc";
  limit: string;
  offset: string;
  search: string;
  fields: readonly DeliveryField[];
};
export type ChangedParam = "sortBy" | "limit" | "offset" | "search" | "fields";
// Preferences contain no content, keys or authentication. Browser memory only.
const preferences = new Map<
  string,
  { controls: IntegrationControls; format: CodeFormat }
>();
function contextKey(context: IntegrationContext) {
  const target = context.target;
  return `${context.workspaceId}:${target.kind}:${target.kind === "directory" ? target.directoryId : target.entryId}`;
}
type CopyStatus = "idle" | "pending" | "copied" | "manual";
type Session = {
  identity: string;
  generation: symbol;
  revision: number;
  controls: IntegrationControls;
  format: CodeFormat;
  copyStatus: CopyStatus;
  copyFeedbackRevision: number;
  changedParam: ChangedParam | null;
};
function newSession(identity: string, context: IntegrationContext): Session {
  const directory = DELIVERY_CONTRACT.operations.directory;
  const saved = preferences.get(contextKey(context));
  return {
    identity,
    generation: Symbol(),
    revision: 0,
    format: saved?.format ?? "curl",
    copyStatus: "idle",
    copyFeedbackRevision: 0,
    changedParam: null,
    controls: saved?.controls ?? {
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
  const { controls, format, copyStatus, copyFeedbackRevision, changedParam } =
    current;
  const generation = current.generation;
  const revision = current.revision;
  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timer = window.setTimeout(() => {
      setSession((previous) =>
        previous.generation === generation && previous.revision === revision
          ? { ...previous, copyStatus: "idle" }
          : previous,
      );
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copyStatus, generation, revision, copyFeedbackRevision]);
  const preferenceKey = contextKey(context);
  useEffect(() => {
    preferences.set(preferenceKey, { controls, format });
  }, [preferenceKey, controls, format]);
  useEffect(() => {
    if (!changedParam) return;
    const timer = window.setTimeout(() => {
      setSession((previous) =>
        previous.generation === generation && previous.revision === revision
          ? { ...previous, changedParam: null }
          : previous,
      );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [changedParam, generation, revision]);
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
  const invalidFields = { limit: false, offset: false, search: false };
  if (target.kind === "directory") {
    const parsed = DirectoryOptionsSchema.safeParse(options);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "limit" || field === "offset" || field === "search")
          invalidFields[field] = true;
      }
    }
  }
  const result = buildIntegrationRequest(context, options);
  const snippet = result.ok
    ? buildRequestSnippets(result.request)[format]
    : undefined;

  function updateControls(patch: Partial<IntegrationControls>) {
    const changed: ChangedParam | null =
      patch.sortBy !== undefined || patch.sortDirection !== undefined
        ? "sortBy"
        : patch.limit !== undefined
          ? "limit"
          : patch.offset !== undefined
            ? "offset"
            : patch.search !== undefined
              ? "search"
              : patch.fields !== undefined
                ? "fields"
                : null;
    setSession((previous) => ({
      ...previous,
      controls: { ...previous.controls, ...patch },
      changedParam: changed,
      revision: previous.revision + 1,
      copyStatus: "idle",
    }));
  }
  function setFormat(next: CodeFormat) {
    setSession((previous) => ({
      ...previous,
      format: next,
      changedParam: null,
      revision: previous.revision + 1,
      copyStatus: "idle",
    }));
  }
  async function copy() {
    if (snippet === undefined || writeInFlight.current) return;
    writeInFlight.current = true;
    setCopyPending(true);
    const copySession = current;
    const complete = (status: CopyStatus) =>
      setSession((previous) =>
        previous.generation === copySession.generation &&
        previous.revision === copySession.revision
          ? {
              ...previous,
              copyStatus: status,
              copyFeedbackRevision:
                previous.copyFeedbackRevision +
                (status === "copied" || status === "manual" ? 1 : 0),
            }
          : previous,
      );
    complete("pending");
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        complete("manual");
        return;
      }
      await serializeClipboardWrite(() =>
        navigator.clipboard.writeText(snippet),
      );
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
    invalidFields,
    result,
    snippet,
    format,
    copyStatus,
    copyFeedbackRevision,
    changedParam,
    copyPending,
    updateControls,
    setFormat,
    copy,
  };
}
export type ContentIntegrationController = ReturnType<
  typeof useContentIntegration
>;
