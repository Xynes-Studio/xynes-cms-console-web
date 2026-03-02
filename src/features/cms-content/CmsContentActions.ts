import {
  createWorkspaceContentEntry,
  type WorkspaceContentEntry,
} from "../../lib/dashboard/content-entries-client";
import { toSafeDashboardPath } from "../../lib/dashboard/workspace-route";

const CREATE_ENTRY_DEFAULT_TITLE = "Untitled";

const CREATE_ROUTE_MISCONFIG_PATTERN =
  /CONTENT_TYPE_ROUTE_SEGMENT_NOT_FOUND|CONTENT_TYPE_NOT_FOUND|DIRECTORY_ROUTE_SEGMENT_NOT_FOUND|ROUTE_SEGMENT_NOT_FOUND|routeSegment:\s*entries/i;
const CREATE_PERMISSION_PATTERN =
  /HTTP\s*403|forbidden|not\s+authorized|permission/i;
const CREATE_NOT_FOUND_PATTERN = /HTTP\s*404|\bnot\s+found\b/i;
const CREATE_SERVICE_UNAVAILABLE_PATTERN =
  /HTTP\s*5\d\d|INTERNAL_ERROR|ECONNREFUSED|fetch\s+failed|network\s+error|Failed\s+to\s+fetch/i;
const CREATE_INVALID_ENTRY_PATTERN =
  /Invalid\s+workspace\s+content\s+entry|Invalid\s+create\s+content\s+entry\s+response/i;

const CMS_CREATE_DEBUG_FLAG = "NEXT_PUBLIC_CMS_DEBUG";

function shouldLogCreateDebug(): boolean {
  if (typeof process !== "undefined") {
    const envFlag = process.env[CMS_CREATE_DEBUG_FLAG]?.trim();
    if (envFlag === "1" || envFlag?.toLowerCase() === "true") {
      return true;
    }
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    const localFlag = window.localStorage.getItem("cms.debug")?.trim();
    return localFlag === "1" || localFlag?.toLowerCase() === "true";
  } catch {
    return false;
  }
}

function logCreateDebug(message: string, context: Record<string, unknown>) {
  if (!shouldLogCreateDebug()) {
    return;
  }

  console.debug(`[CMS][create] ${message}`, context);
}

export function getCreateEntryErrorMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : String(error ?? "");

  if (CREATE_ROUTE_MISCONFIG_PATTERN.test(rawMessage)) {
    return "Content entry create route is not configured in backend yet. Please contact platform team to map /content/entries to directory-based cms.entry.* actions.";
  }

  if (CREATE_PERMISSION_PATTERN.test(rawMessage)) {
    return "You do not have permission to create content in this workspace.";
  }

  if (CREATE_NOT_FOUND_PATTERN.test(rawMessage)) {
    return "Create endpoint is not available for this workspace. Please contact platform team to verify /content/entries is mapped to directory-based cms.entry.* actions.";
  }

  if (CREATE_SERVICE_UNAVAILABLE_PATTERN.test(rawMessage)) {
    return "CMS service is temporarily unavailable. Please retry in a moment, and contact platform team if this persists.";
  }

  if (CREATE_INVALID_ENTRY_PATTERN.test(rawMessage)) {
    return "CMS returned an invalid create response. Please retry, and share the console [CMS][create] log with platform team if this persists.";
  }

  return "Please try again.";
}

export function buildContentEntryEditRoute({
  workspaceSlug,
  entryId,
}: {
  workspaceSlug: string;
  entryId: string;
}) {
  const dashboardPath = toSafeDashboardPath(workspaceSlug);
  if (!dashboardPath) {
    throw new Error("Invalid workspace slug");
  }

  const normalizedEntryId = entryId.trim();
  if (!normalizedEntryId) {
    throw new Error("Invalid entry id");
  }

  return `${dashboardPath}/content/entry/${encodeURIComponent(normalizedEntryId)}/edit`;
}

export async function createDraftEntryAndResolveEditPath({
  apiBaseUrl,
  workspaceId,
  workspaceSlug,
  accessToken,
  directoryId,
  createEntry = createWorkspaceContentEntry,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  workspaceSlug: string;
  accessToken: string;
  directoryId?: string | null;
  createEntry?: (params: {
    apiBaseUrl: string;
    workspaceId: string;
    accessToken: string;
    payload: { title: string; directoryId?: string };
  }) => Promise<Pick<WorkspaceContentEntry, "id">>;
}) {
  const normalizedDirectoryId = directoryId?.trim();
  const payload = normalizedDirectoryId
    ? {
        title: CREATE_ENTRY_DEFAULT_TITLE,
        directoryId: normalizedDirectoryId,
      }
    : { title: CREATE_ENTRY_DEFAULT_TITLE };

  logCreateDebug("create start", {
    workspaceId,
    workspaceSlug,
    hasDirectoryId: Boolean(normalizedDirectoryId),
    payloadKeys: Object.keys(payload),
  });

  let createdEntry: Pick<WorkspaceContentEntry, "id">;

  try {
    createdEntry = await createEntry({
      apiBaseUrl,
      workspaceId,
      accessToken,
      payload,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : String(error ?? "unknown");

    console.error("[CMS][create] draft create failed", {
      workspaceId,
      workspaceSlug,
      directoryId: normalizedDirectoryId ?? null,
      payloadKeys: Object.keys(payload),
      errorMessage: rawMessage,
    });

    throw error;
  }

  const editPath = buildContentEntryEditRoute({
    workspaceSlug,
    entryId: createdEntry.id,
  });

  logCreateDebug("create success", {
    workspaceId,
    entryId: createdEntry.id,
    editPath,
  });

  return editPath;
}
