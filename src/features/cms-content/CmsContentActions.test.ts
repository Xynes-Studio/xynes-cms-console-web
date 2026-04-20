import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentEntryEditRoute,
  buildContentEntryShareUrl,
  createDraftEntryAndResolveEditPath,
  getCreateEntryErrorMessage,
} from "./CmsContentActions";

describe("CmsContentActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a canonical dashboard editor route", () => {
    expect(
      buildContentEntryEditRoute({
        workspaceSlug: "Acme-Team",
        entryId: "entry 123",
      }),
    ).toBe("/dashboard/acme-team/content/entry/entry%20123/edit");
  });

  it("throws when workspace slug is invalid", () => {
    expect(() =>
      buildContentEntryEditRoute({
        workspaceSlug: "",
        entryId: "entry-1",
      }),
    ).toThrow("Invalid workspace slug");
  });

  it("creates a draft entry and returns editor path", async () => {
    const createEntry = vi.fn(async () => ({ id: "entry-42" }));

    const path = await createDraftEntryAndResolveEditPath({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      workspaceSlug: "acme-team",
      accessToken: "jwt-token",
      directoryId: "dir-1",
      createEntry,
    });

    expect(createEntry).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      payload: {
        title: "Untitled",
        directoryId: "dir-1",
      },
    });
    expect(path).toBe("/dashboard/acme-team/content/entry/entry-42/edit");
  });

  it("omits directoryId when not set", async () => {
    const createEntry = vi.fn(async () => ({ id: "entry-1" }));

    await createDraftEntryAndResolveEditPath({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      workspaceSlug: "acme-team",
      accessToken: "jwt-token",
      directoryId: null,
      createEntry,
    });

    expect(createEntry).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      payload: {
        title: "Untitled",
      },
    });
  });

  it("maps backend route misconfiguration error to actionable copy", () => {
    const message = getCreateEntryErrorMessage(
      new Error("DIRECTORY_ROUTE_SEGMENT_NOT_FOUND"),
    );

    expect(message).toContain("directory-based");
  });

  it("maps permission errors to access-aware copy", () => {
    const message = getCreateEntryErrorMessage(
      new Error("Failed to create content entry: HTTP 403 Forbidden"),
    );

    expect(message).toBe(
      "You do not have permission to create content in this workspace.",
    );
  });

  it("maps HTTP 404 create failures to endpoint guidance", () => {
    const message = getCreateEntryErrorMessage(
      new Error("Failed to create content entry: HTTP 404 Not Found"),
    );

    expect(message).toContain("Create endpoint is not available");
    expect(message).toContain("directory-based");
  });

  it("maps HTTP 5xx create failures to service availability copy", () => {
    const message = getCreateEntryErrorMessage(
      new Error(
        "Failed to create content entry: HTTP 500 Internal Server Error",
      ),
    );

    expect(message).toContain("temporarily unavailable");
  });

  it("maps invalid create response shape errors to debug-guided copy", () => {
    const message = getCreateEntryErrorMessage(
      new Error("Invalid workspace content entry"),
    );

    expect(message).toContain("invalid create response");
    expect(message).toContain("[CMS][create]");
  });

  it("logs create failure context for debugging and rethrows", async () => {
    const createEntry = vi.fn(async () => {
      throw new Error("Failed to create content entry: HTTP 500");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createDraftEntryAndResolveEditPath({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        workspaceSlug: "acme-team",
        accessToken: "jwt-token",
        directoryId: "dir-1",
        createEntry,
      }),
    ).rejects.toThrow("Failed to create content entry: HTTP 500");

    expect(errorSpy).toHaveBeenCalledWith(
      "[CMS][create] draft create failed",
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceSlug: "acme-team",
        directoryId: "dir-1",
      }),
    );
  });

  it("logs create failure context when createEntry throws non-Error value", async () => {
    const createEntry = vi.fn(async () => {
      throw "network down";
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createDraftEntryAndResolveEditPath({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        workspaceSlug: "acme-team",
        accessToken: "jwt-token",
        directoryId: "dir-1",
        createEntry,
      }),
    ).rejects.toBe("network down");

    expect(errorSpy).toHaveBeenCalledWith(
      "[CMS][create] draft create failed",
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceSlug: "acme-team",
        directoryId: "dir-1",
        errorMessage: "network down",
      }),
    );
  });
});

describe("getCreateEntryErrorMessage — edge branches", () => {
  it("returns fallback copy for unknown/unclassified errors", () => {
    expect(getCreateEntryErrorMessage(new Error("something unexpected"))).toBe(
      "Please try again.",
    );
  });

  it("coerces non-Error thrown values to string before pattern matching", () => {
    expect(getCreateEntryErrorMessage("ECONNREFUSED")).toContain(
      "temporarily unavailable",
    );
  });

  it("coerces null to empty string and returns fallback copy", () => {
    expect(getCreateEntryErrorMessage(null)).toBe("Please try again.");
  });

  it("coerces undefined to empty string and returns fallback copy", () => {
    expect(getCreateEntryErrorMessage(undefined)).toBe("Please try again.");
  });
});

describe("debug logging branches", () => {
  it("emits console.debug when localStorage cms.debug=1 and create succeeds", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      window.localStorage.setItem("cms.debug", "1");
      const createEntry = vi.fn(async () => ({ id: "entry-dbg" }));

      const path = await createDraftEntryAndResolveEditPath({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "ws-debug",
        workspaceSlug: "debug-team",
        accessToken: "jwt-debug",
        createEntry,
      });

      expect(path).toBe("/dashboard/debug-team/content/entry/entry-dbg/edit");
      expect(debugSpy).toHaveBeenCalledWith(
        "[CMS][create] create start",
        expect.objectContaining({ workspaceId: "ws-debug" }),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        "[CMS][create] create success",
        expect.objectContaining({ entryId: "entry-dbg" }),
      );
    } finally {
      window.localStorage.removeItem("cms.debug");
      debugSpy.mockRestore();
    }
  });

  it("emits console.debug when localStorage cms.debug=true (string)", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      window.localStorage.setItem("cms.debug", "true");
      const createEntry = vi.fn(async () => ({ id: "entry-dbg-true" }));

      await createDraftEntryAndResolveEditPath({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "ws-1",
        workspaceSlug: "acme-team",
        accessToken: "jwt",
        createEntry,
      });

      expect(debugSpy).toHaveBeenCalled();
    } finally {
      window.localStorage.removeItem("cms.debug");
      debugSpy.mockRestore();
    }
  });

  it("does not emit console.debug when no flag is set", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const createEntry = vi.fn(async () => ({ id: "entry-quiet" }));

    await createDraftEntryAndResolveEditPath({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "ws-1",
      workspaceSlug: "acme-team",
      accessToken: "jwt",
      createEntry,
    });

    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});

describe("buildContentEntryEditRoute — edge cases", () => {
  it("throws when entryId is blank", () => {
    expect(() =>
      buildContentEntryEditRoute({ workspaceSlug: "acme-team", entryId: "  " }),
    ).toThrow("Invalid entry id");
  });

  it("encodes special characters in entryId", () => {
    expect(
      buildContentEntryEditRoute({
        workspaceSlug: "acme-team",
        entryId: "entry/with/slashes",
      }),
    ).toBe("/dashboard/acme-team/content/entry/entry%2Fwith%2Fslashes/edit");
  });
});

describe("buildContentEntryShareUrl", () => {
  it("builds an absolute internal edit URL from origin, workspace slug, and entry id", () => {
    expect(
      buildContentEntryShareUrl({
        origin: "http://localhost:3000",
        workspaceSlug: "acme-team",
        entryId: "entry-1",
      }),
    ).toBe("http://localhost:3000/dashboard/acme-team/content/entry/entry-1/edit");
  });

  it("normalizes origin trailing slash when building share URL", () => {
    expect(
      buildContentEntryShareUrl({
        origin: "http://localhost:3000/",
        workspaceSlug: "acme-team",
        entryId: "entry-1",
      }),
    ).toBe("http://localhost:3000/dashboard/acme-team/content/entry/entry-1/edit");
  });
});
