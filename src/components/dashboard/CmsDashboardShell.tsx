"use client";

import type { ComponentProps, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@lumia-ui/components";
import {
  DashboardShell,
  type DashboardNavItem as LumiaDashboardNavItem,
  type DashboardShellLabels,
} from "@lumia-ui/layout";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import { useTranslations } from "next-intl";
import {
  addContentDirectory,
  getContentDirectoryPathIds,
  getContentDirectoryPathSegment,
  maxContentDirectoryNameLength,
  materializePersistedContentDirectories,
  removeContentDirectory,
  updateContentDirectoryName,
  type ContentDirectoryNode,
} from "../../lib/dashboard/content-directory-tree";
import {
  createWorkspaceContentDirectory,
  deleteWorkspaceContentDirectory,
  listWorkspaceContentDirectories,
  updateWorkspaceContentDirectory,
} from "../../lib/dashboard/content-directories-client";
import {
  buildDashboardSectionPath,
  defaultDashboardSection,
  parseDashboardSectionPath,
} from "../../lib/dashboard/dashboard-section-route";
import { getCmsDashboardNavItems } from "./navigation";
import { WorkspaceSelectionSync } from "./WorkspaceSelectionSync";

type CmsDashboardShellProps = {
  children: ReactNode;
  workspaceSlug: string;
};

type LumiaDashboardChildren = ComponentProps<typeof DashboardShell>["children"];
const authWorkspaceCreationPath = "/onboarding";

/**
 * WSA-FIX-2 (2026-05-12): When CMS Console links to the auth app's
 * onboarding flow, append `?redirect=<encoded CMS landing URL>` so the
 * post-create redirect honours the origin app. The auth app validates the
 * redirect against its `getAllowedRedirectDomains()` allowlist; we hand it
 * the canonical CMS dashboard resolver (`${NEXT_PUBLIC_APP_URL}/dashboard`),
 * which redirects to the user's current/first workspace once it exists.
 *
 * If `NEXT_PUBLIC_APP_URL` (the CMS console's own absolute base URL) is
 * missing or malformed we omit the `redirect` param entirely — better to
 * fall through to the auth app's Auth-Admin fallback than to send a
 * relative URL that resolves against the *auth app* origin.
 */
function buildCmsPostCreateRedirectTarget(): string | null {
  const cmsBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!cmsBaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(cmsBaseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const normalizedBase = cmsBaseUrl.replace(/\/+$/, "");
    return `${normalizedBase}/dashboard`;
  } catch {
    return null;
  }
}

function buildAuthWorkspaceCreationUrl(): string {
  const authAppUrl = process.env.NEXT_PUBLIC_AUTH_APP_URL?.trim();
  const redirectTarget = buildCmsPostCreateRedirectTarget();
  const searchSuffix = redirectTarget
    ? `?redirect=${encodeURIComponent(redirectTarget)}`
    : "";

  if (!authAppUrl) {
    return `${authWorkspaceCreationPath}${searchSuffix}`;
  }

  return `${authAppUrl.replace(/\/+$/, "")}${authWorkspaceCreationPath}${searchSuffix}`;
}

type ContentTreeNavNode = ContentDirectoryNode & {
  href: string;
  children?: ContentTreeNavNode[];
};

const createRouteDirectoryId = (pathSegments: string[]) =>
  `content-path-${pathSegments.join("--")}`;

const replaceDirectoryNode = ({
  nodes,
  optimisticId,
  nextNode,
}: {
  nodes: ContentDirectoryNode[];
  optimisticId: string;
  nextNode: ContentDirectoryNode;
}): ContentDirectoryNode[] =>
  nodes.map((node) => {
    if (node.id === optimisticId) {
      return {
        ...node,
        id: nextNode.id,
        label: nextNode.label,
        pathSegment: nextNode.pathSegment,
      };
    }

    if (!node.children?.length) {
      return node;
    }

    return {
      ...node,
      children: replaceDirectoryNode({
        nodes: node.children,
        optimisticId,
        nextNode,
      }),
    };
  });

const mapDirectoryNodesWithHref = ({
  nodes,
  workspaceSlug,
  parentSegments = [],
}: {
  nodes: ContentDirectoryNode[];
  workspaceSlug: string;
  parentSegments?: string[];
}): ContentTreeNavNode[] =>
  nodes.map((node) => {
    const currentSegment = getContentDirectoryPathSegment(node);
    const tailSegments = [...parentSegments, currentSegment];
    const href =
      buildDashboardSectionPath({
        workspaceSlug,
        section: "content",
        tailSegments,
      }) ?? "/dashboard/content";

    return {
      id: node.id,
      label: node.label,
      href,
      children: node.children?.length
        ? mapDirectoryNodesWithHref({
            nodes: node.children,
            workspaceSlug,
            parentSegments: tailSegments,
          })
        : [],
    };
  });

const collectSubtreeIdsByNodeId = ({
  nodes,
  nodeId,
}: {
  nodes: ContentDirectoryNode[];
  nodeId: string;
}): string[] => {
  const collectAllIds = (node: ContentDirectoryNode): string[] => [
    node.id,
    ...(node.children?.flatMap(collectAllIds) ?? []),
  ];

  const find = (items: ContentDirectoryNode[]): ContentDirectoryNode | null => {
    for (const item of items) {
      if (item.id === nodeId) {
        return item;
      }
      if (!item.children?.length) {
        continue;
      }
      const nested = find(item.children);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  const node = find(nodes);
  return node ? collectAllIds(node) : [];
};

export function CmsDashboardShell({
  children,
  workspaceSlug,
}: CmsDashboardShellProps) {
  const { show: showToast } = useToast();
  const t = useTranslations("cms.shell");
  const tShellNav = useTranslations("cms.shell.shell.navigation");
  const tShellWorkspace = useTranslations("cms.shell.shell.workspace");
  const tShellProfile = useTranslations("cms.shell.shell.profile");
  const tShellNotifications = useTranslations("cms.shell.shell.notifications");
  const tShellUserMenu = useTranslations("cms.shell.shell.userMenu");
  const tShell = useTranslations("cms.shell.shell");
  const tStatus = useTranslations("cms.shell.status");
  const router = useRouter();
  const activePath = usePathname();
  const {
    user,
    workspaces,
    isAuthenticated,
    isLoading: isAuthLoading,
    redirectToLogin,
    getAccessToken,
  } = useAuth();
  const { currentWorkspace, selectWorkspace } = useWorkspace();
  // BUG-AUTH-9 follow-up (PR #43, Codex P1): `selectWorkspace` is pulled so
  // the wrong-slug guard can sync the SDK selection to a known-accessible
  // workspace before redirecting. Without this sync, the `/dashboard`
  // resolver page can re-pick a revoked workspace (it prefers
  // `currentWorkspace?.slug` over the auth-validated `workspaces` list),
  // which immediately bounces back into this guard and produces an
  // infinite redirect loop.
  const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();
  const workspaceBySlug = useMemo(
    () =>
      workspaces.find(
        (workspace) =>
          workspace.slug.trim().toLowerCase() === normalizedWorkspaceSlug,
      ) ?? null,
    [normalizedWorkspaceSlug, workspaces],
  );
  const contentDirectoryWorkspaceId = workspaceBySlug?.id ?? null;
  const canManageDirectories = workspaceBySlug?.role === "workspace_owner";
  const directoryActionDisabledReason = t("directory.ownerOnly");
  const fallbackContentPath =
    buildDashboardSectionPath({
      workspaceSlug,
      section: defaultDashboardSection,
    }) ?? "/dashboard/content";
  const safeActivePath =
    activePath && activePath.startsWith("/dashboard/")
      ? activePath
      : fallbackContentPath;
  const parsedActivePath = parseDashboardSectionPath(safeActivePath);
  const contentTailKey =
    parsedActivePath &&
    parsedActivePath.workspaceSlug === normalizedWorkspaceSlug &&
    parsedActivePath.section === "content"
      ? parsedActivePath.tailSegments.join("/")
      : "";
  const activeContentTailSegments = useMemo(
    () => (contentTailKey ? contentTailKey.split("/") : []),
    [contentTailKey],
  );
  const initialDirectoryTree: ContentDirectoryNode[] = [];
  const [contentDirectories, setContentDirectories] =
    useState<ContentDirectoryNode[]>(initialDirectoryTree);
  const [directoryDataRevision, setDirectoryDataRevision] = useState(0);
  const [expandedDirectoryIds, setExpandedDirectoryIds] = useState<string[]>(
    getContentDirectoryPathIds({
      nodes: initialDirectoryTree,
      pathSegments: activeContentTailSegments,
    }),
  );
  const notifyDirectoryActionFailed = (title: string) => {
    showToast({
      variant: "error",
      title,
      description: t("directory.mutationErrorDescription"),
    });
  };

  useEffect(() => {
    if (isAuthLoading || isAuthenticated) {
      return;
    }

    redirectToLogin(window.location.href);
  }, [isAuthLoading, isAuthenticated, redirectToLogin]);

  /**
   * BUG-AUTH-9 (2026-06-01): Workspace guard.
   *
   * Two cases (both fire AFTER auth has resolved AND the user is
   * authenticated — the auth-loading + redirect-to-login effect above owns
   * the unauthenticated path):
   *
   *   1. `workspaces.length === 0` → the user has no workspaces. Send them
   *      cross-app to the auth-app onboarding flow via
   *      `buildAuthWorkspaceCreationUrl()` (which already honours WSA-FIX-2
   *      `?redirect=<cms-landing>` semantics so the user lands back here
   *      once they create one).
   *
   *   2. `workspaces.length > 0` AND `workspaceBySlug === null` → the slug
   *      in the URL does NOT belong to any workspace the authenticated
   *      user can access. This is the cross-tenant probe path (someone
   *      typed or pasted another user's workspace slug). Redirect to
   *      `/dashboard` (the CMS Console's own dashboard resolver), which
   *      picks the user's current/first workspace and routes them to its
   *      content section. We deliberately do NOT redirect cross-app to the
   *      auth-app workspace selector for this case — staying inside the
   *      CMS Console preserves any in-flight CMS routing the user was
   *      doing, and the resolver page is the canonical "pick a workspace
   *      and continue" surface for this app.
   *
   * The render guard below the effect short-circuits to a fallback
   * `<main role="status">` so the Lumia `DashboardShell` is never mounted
   * against a `null` workspace context. The two booleans are derived
   * (no `useState`) — `workspaceBySlug` is already memoised above and
   * `isAuthLoading` / `isAuthenticated` come from `useAuth()`, so the
   * derived values are stable across renders.
   *
   * Architectural note: the fallback `<main>` uses `min-h-screen` because
   * NO `<DashboardShell>` is mounted at this point (same posture as the
   * two pre-existing pre-auth fallbacks in this file). The BUG-CMS-9
   * shell-contract regression guard (`app/dashboard-shell-contract.test.ts`)
   * already allowlists `CmsDashboardShell.tsx` for that pattern.
   */
  const isWorkspaceSlugUnknown =
    !isAuthLoading &&
    isAuthenticated &&
    workspaces.length > 0 &&
    workspaceBySlug === null;
  const isWorkspaceListEmpty =
    !isAuthLoading && isAuthenticated && workspaces.length === 0;
  const shouldShowWorkspaceGuardFallback =
    isWorkspaceSlugUnknown || isWorkspaceListEmpty;

  /**
   * BUG-AUTH-9 follow-up (PR #43, Codex P1): "Avoid redirecting stale
   * workspace slugs back into the guard."
   *
   * The wrong-slug branch USED to redirect to `/dashboard` and rely on the
   * resolver page (`app/dashboard/page.tsx`) to pick a workspace. But the
   * resolver prefers `currentWorkspace?.slug` over the auth-validated
   * `workspaces` list. If the user's selected workspace was revoked (or
   * the SDK still has a stale selection that no longer matches any
   * accessible workspace), the resolver sends them right back to the same
   * inaccessible `/dashboard/<stale-slug>/content`, which re-triggers this
   * guard and produces an infinite redirect loop.
   *
   * Fix: skip the resolver round-trip. Pick the first auth-validated
   * workspace whose slug yields a valid dashboard path, sync the SDK
   * selection via `selectWorkspace(target.id)`, then redirect directly to
   * its `/dashboard/<slug>/<defaultSection>` URL. The selection sync
   * ensures any UI surface that depends on `currentWorkspace` reflects the
   * post-redirect state on the next render.
   *
   * If no accessible workspace can produce a valid path (defensive — the
   * `workspaces.length > 0` precondition makes this practically
   * unreachable), fall back to the resolver as before; it will surface
   * its "Dashboard not found" envelope rather than loop.
   */
  const wrongSlugFallbackTarget = useMemo(() => {
    if (!isWorkspaceSlugUnknown) {
      return null;
    }
    const accessible = workspaces.find((candidate) => {
      const candidateSlug = candidate?.slug?.trim() ?? "";
      if (!candidateSlug) {
        return false;
      }
      const path = buildDashboardSectionPath({
        workspaceSlug: candidateSlug,
        section: defaultDashboardSection,
      });
      return Boolean(path);
    });
    if (!accessible) {
      return null;
    }
    const accessibleSlug = accessible.slug.trim();
    const path =
      buildDashboardSectionPath({
        workspaceSlug: accessibleSlug,
        section: defaultDashboardSection,
      }) ?? null;
    return path ? { id: accessible.id, path } : null;
  }, [isWorkspaceSlugUnknown, workspaces]);

  useEffect(() => {
    if (isWorkspaceListEmpty) {
      router.replace(buildAuthWorkspaceCreationUrl());
      return;
    }
    if (isWorkspaceSlugUnknown) {
      if (wrongSlugFallbackTarget) {
        // Sync the SDK selection BEFORE the redirect so the resolver (if
        // anything else navigates the user through `/dashboard` later)
        // does not re-pick the stale slug. `selectWorkspace` is a no-op
        // when the id already matches the current selection.
        selectWorkspace(wrongSlugFallbackTarget.id);
        router.replace(wrongSlugFallbackTarget.path);
        return;
      }
      // Defensive fallback: no accessible workspace yielded a valid path.
      // The resolver page will render its "Dashboard not found" envelope.
      router.replace("/dashboard");
    }
  }, [
    isWorkspaceListEmpty,
    isWorkspaceSlugUnknown,
    router,
    selectWorkspace,
    wrongSlugFallbackTarget,
  ]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !contentDirectoryWorkspaceId) {
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (!apiBaseUrl) {
      return;
    }

    const abortController = new AbortController();
    void (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || abortController.signal.aborted) {
          return;
        }

        const persistedDirectories = await listWorkspaceContentDirectories({
          apiBaseUrl,
          workspaceId: contentDirectoryWorkspaceId,
          accessToken,
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) {
          return;
        }

        const apiDirectoryNodes = materializePersistedContentDirectories({
          baseNodes: [],
          directories: persistedDirectories,
        });
        setContentDirectories(apiDirectoryNodes);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error(
            "Failed to load workspace content directory tree",
            error,
          );
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [
    contentDirectoryWorkspaceId,
    directoryDataRevision,
    getAccessToken,
    isAuthLoading,
    isAuthenticated,
  ]);

  const navItems: LumiaDashboardNavItem[] = getCmsDashboardNavItems(
    workspaceSlug,
    {
      contents: t("nav.contents"),
      plugins: t("nav.plugins"),
      "access-control": t("nav.accessControl"),
      integrations: t("nav.integrations"),
      settings: t("nav.settings"),
    },
  ).map((item) => ({
    id: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));
  const contentsHref =
    navItems.find((item) => item.id === "contents")?.href ??
    fallbackContentPath;
  const currentDashboardPath = safeActivePath;
  const materializedContentDirectories = contentDirectories;
  const routeExpandedDirectoryIds = useMemo(
    () =>
      getContentDirectoryPathIds({
        nodes: materializedContentDirectories,
        pathSegments: activeContentTailSegments,
      }),
    [activeContentTailSegments, materializedContentDirectories],
  );
  const effectiveExpandedDirectoryIds = useMemo(() => {
    if (routeExpandedDirectoryIds.length === 0) {
      return expandedDirectoryIds;
    }

    const merged = [...expandedDirectoryIds];
    routeExpandedDirectoryIds.forEach((id) => {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    });

    return merged;
  }, [expandedDirectoryIds, routeExpandedDirectoryIds]);

  const directoryNodes = useMemo(
    () =>
      mapDirectoryNodesWithHref({
        nodes: materializedContentDirectories,
        workspaceSlug: normalizedWorkspaceSlug,
      }),
    [materializedContentDirectories, normalizedWorkspaceSlug],
  );
  const activeDirectoryHref =
    activeContentTailSegments.length > 0
      ? (buildDashboardSectionPath({
          workspaceSlug: normalizedWorkspaceSlug,
          section: "content",
          tailSegments: activeContentTailSegments,
        }) ?? undefined)
      : undefined;

  const handleCreateDirectory = (input: {
    parentId: string | null;
    name: string;
  }) => {
    if (
      isAuthLoading ||
      !isAuthenticated ||
      !contentDirectoryWorkspaceId ||
      !canManageDirectories
    ) {
      return;
    }

    if (input.parentId?.startsWith("content-path-")) {
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (!apiBaseUrl) {
      notifyDirectoryActionFailed(t("directory.createFailedTitle"));
      return;
    }

    const optimisticDirectoryId = `content-pending-${createRouteDirectoryId([
      ...(input.parentId ? [input.parentId] : []),
      input.name.trim().toLowerCase(),
      Date.now().toString(),
    ])}`;

    setContentDirectories((previous) =>
      addContentDirectory({
        nodes: previous,
        parentId: input.parentId,
        rawName: input.name,
        createId: () => optimisticDirectoryId,
      }),
    );

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setContentDirectories((previous) =>
            removeContentDirectory({
              nodes: previous,
              nodeId: optimisticDirectoryId,
            }),
          );
          notifyDirectoryActionFailed(t("directory.createFailedTitle"));
          return;
        }

        const createdDirectory = await createWorkspaceContentDirectory({
          apiBaseUrl,
          workspaceId: contentDirectoryWorkspaceId,
          accessToken,
          parentId: input.parentId,
          name: input.name,
        });

        setContentDirectories((previous) =>
          replaceDirectoryNode({
            nodes: previous,
            optimisticId: optimisticDirectoryId,
            nextNode: {
              id: createdDirectory.id,
              label: createdDirectory.name,
              pathSegment: createdDirectory.pathSegment,
            },
          }),
        );
        setDirectoryDataRevision((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to persist workspace content directory", error);
        setContentDirectories((previous) =>
          removeContentDirectory({
            nodes: previous,
            nodeId: optimisticDirectoryId,
          }),
        );
        notifyDirectoryActionFailed(t("directory.createFailedTitle"));
        setDirectoryDataRevision((previous) => previous + 1);
      }
    })();
  };

  const handleRenameDirectory = (input: { nodeId: string; name: string }) => {
    if (
      isAuthLoading ||
      !isAuthenticated ||
      !contentDirectoryWorkspaceId ||
      !canManageDirectories
    ) {
      return;
    }

    if (input.nodeId.startsWith("content-path-")) {
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (!apiBaseUrl) {
      notifyDirectoryActionFailed(t("directory.renameFailedTitle"));
      return;
    }

    const previousTree = contentDirectories;
    const nextTree = updateContentDirectoryName({
      nodes: previousTree,
      nodeId: input.nodeId,
      rawName: input.name,
    });
    if (nextTree === previousTree) {
      return;
    }

    setContentDirectories(nextTree);

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setContentDirectories(previousTree);
          notifyDirectoryActionFailed(t("directory.renameFailedTitle"));
          return;
        }

        await updateWorkspaceContentDirectory({
          apiBaseUrl,
          workspaceId: contentDirectoryWorkspaceId,
          directoryId: input.nodeId,
          accessToken,
          name: input.name,
        });
        setDirectoryDataRevision((previous) => previous + 1);
      } catch (error) {
        console.error(
          "Failed to persist workspace content directory rename",
          error,
        );
        setContentDirectories(previousTree);
        notifyDirectoryActionFailed(t("directory.renameFailedTitle"));
        setDirectoryDataRevision((previous) => previous + 1);
      }
    })();
  };

  const handleDeleteDirectory = (input: { nodeId: string }) => {
    if (
      isAuthLoading ||
      !isAuthenticated ||
      !contentDirectoryWorkspaceId ||
      !canManageDirectories
    ) {
      return;
    }

    if (input.nodeId.startsWith("content-path-")) {
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (!apiBaseUrl) {
      notifyDirectoryActionFailed(t("directory.deleteFailedTitle"));
      return;
    }

    const previousTree = contentDirectories;
    const previousExpandedIds = expandedDirectoryIds;
    const removedSubtreeIds = new Set(
      collectSubtreeIdsByNodeId({
        nodes: previousTree,
        nodeId: input.nodeId,
      }),
    );
    if (removedSubtreeIds.size === 0) {
      return;
    }

    setExpandedDirectoryIds((current) =>
      current.filter((id) => !removedSubtreeIds.has(id)),
    );
    setContentDirectories((previous) =>
      removeContentDirectory({
        nodes: previous,
        nodeId: input.nodeId,
      }),
    );

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setContentDirectories(previousTree);
          setExpandedDirectoryIds(previousExpandedIds);
          notifyDirectoryActionFailed(t("directory.deleteFailedTitle"));
          return;
        }

        await deleteWorkspaceContentDirectory({
          apiBaseUrl,
          workspaceId: contentDirectoryWorkspaceId,
          directoryId: input.nodeId,
          accessToken,
        });
        setDirectoryDataRevision((previous) => previous + 1);
      } catch (error) {
        console.error(
          "Failed to persist workspace content directory delete",
          error,
        );
        setContentDirectories(previousTree);
        setExpandedDirectoryIds(previousExpandedIds);
        notifyDirectoryActionFailed(t("directory.deleteFailedTitle"));
        setDirectoryDataRevision((previous) => previous + 1);
      }
    })();
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    const selectedWorkspace = workspaces.find(
      (workspace) => workspace.id === workspaceId,
    );
    if (!selectedWorkspace?.slug) {
      return;
    }

    const parsedActivePath = parseDashboardSectionPath(activePath);
    const nextPath =
      buildDashboardSectionPath({
        workspaceSlug: selectedWorkspace.slug,
        section: parsedActivePath?.section ?? defaultDashboardSection,
        tailSegments: parsedActivePath?.tailSegments ?? [],
      }) ??
      buildDashboardSectionPath({
        workspaceSlug: selectedWorkspace.slug,
        section: defaultDashboardSection,
      });

    if (!nextPath) {
      return;
    }

    router.push(nextPath);
  };

  // Build the Lumia DashboardShell label bundle from the cms.shell catalog
  // (UXR-6). Each branch is a thin map: this is the single seam where CMS
  // Console owns translated product copy and the design-system stays
  // copy-neutral. Lumia's defaults remain English for backwards-compatible
  // callers that don't pass `labels`. ICU placeholders ({unreadCount},
  // {title}) are interpolated by next-intl at render time.
  const shellLabels: DashboardShellLabels = useMemo(
    () => ({
      navigation: {
        mainContent: tShellNav("mainContent"),
        sidebar: tShellNav("sidebar"),
        sidebarScrollArea: tShellNav("sidebarScrollArea"),
        dashboardNavigation: tShellNav("dashboardNavigation"),
        mobileDashboardNavigation: tShellNav("mobileDashboardNavigation"),
        mobileMenu: tShellNav("mobileMenu"),
        openMobileMenu: tShellNav("openMobileMenu"),
      },
      workspace: {
        trigger: tShellWorkspace("trigger"),
        fallbackName: tShellWorkspace("fallbackName"),
        currentSection: tShellWorkspace("currentSection"),
        currentBadge: tShellWorkspace("currentBadge"),
        switchToSection: tShellWorkspace("switchToSection"),
        createAction: tShellWorkspace("createAction"),
        createUnavailableAction: tShellWorkspace("createUnavailableAction"),
      },
      profile: {
        trigger: tShellProfile("trigger"),
        profileAction: tShellProfile("profileAction"),
        logoutAction: tShellProfile("logoutAction"),
      },
      notifications: {
        open: tShellNotifications("open"),
        tab: tShellNotifications("tab"),
        title: (unreadCount: number) =>
          tShellNotifications("titlePattern", { unreadCount }),
        empty: tShellNotifications("empty"),
        list: tShellNotifications("list"),
        todayGroup: tShellNotifications("todayGroup"),
        yesterdayGroup: tShellNotifications("yesterdayGroup"),
        unreadCount: (unreadCount: number) =>
          tShellNotifications("unreadCountPattern", { unreadCount }),
        delete: (notification) =>
          tShellNotifications("deletePattern", {
            title: notification.title,
          }),
      },
    }),
    [tShellNav, tShellWorkspace, tShellProfile, tShellNotifications],
  );

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-300"
        >
          {tStatus("loadingDashboard")}
        </p>
      </main>
    );
  }

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-300"
        >
          {tStatus("redirectingToLogin")}
        </p>
      </main>
    );
  }

  /**
   * BUG-AUTH-9 (2026-06-01): Workspace-guard fallback. Renders for the brief
   * `router.replace` transition window when EITHER the user has no
   * workspaces (cross-app redirect to auth-app /onboarding) OR the URL slug
   * does not match any workspace they can access (same-app redirect to
   * `/dashboard` resolver). Prevents a flash of the CMS shell rendered
   * against a `null` workspace context.
   *
   * Lives on the BUG-CMS-9 allowlist alongside the two pre-existing
   * pre-auth fallback `<main>` blocks above.
   */
  if (shouldShowWorkspaceGuardFallback) {
    const title = isWorkspaceListEmpty
      ? tStatus("noWorkspaceTitle")
      : tStatus("wrongWorkspaceTitle");
    const description = isWorkspaceListEmpty
      ? tStatus("noWorkspaceDescription")
      : tStatus("wrongWorkspaceDescription");
    return (
      <main
        data-testid="cms-dashboard-workspace-guard-fallback"
        data-guard-reason={isWorkspaceListEmpty ? "no-workspace" : "wrong-slug"}
        className="flex min-h-screen items-center justify-center px-6"
      >
        <div
          role="status"
          aria-live="polite"
          className="flex max-w-md flex-col items-center gap-2 text-center"
        >
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        </div>
      </main>
    );
  }

  const shellChildren = (
    <>
      <WorkspaceSelectionSync workspaceSlug={workspaceSlug} />
      {children}
    </>
  ) as LumiaDashboardChildren;

  return (
    <DashboardShell
      activePath={safeActivePath}
      navItems={navItems}
      onNavigate={(href) => router.push(href)}
      workspace={
        currentWorkspace
          ? {
              id: currentWorkspace.id,
              name: currentWorkspace.name,
              slug: currentWorkspace.slug,
            }
          : null
      }
      workspaceOptions={workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      }))}
      onWorkspaceSelect={handleWorkspaceSelect}
      onCreateWorkspace={() => {
        const target = buildAuthWorkspaceCreationUrl();
        if (/^https?:\/\//i.test(target)) {
          window.location.assign(target);
          return;
        }

        router.push(target);
      }}
      enableWorkspaceCreation={true}
      workspaceCreationDisabledMessage={tShell(
        "workspaceCreationDisabledMessage",
      )}
      userMenu={{
        name:
          user?.displayName || user?.email || tShellUserMenu("fallbackName"),
        email: user?.email || tShellUserMenu("fallbackEmail"),
        avatarSrc: user?.avatarUrl || undefined,
      }}
      onLogout={() =>
        router.push(
          `/logout?redirect=${encodeURIComponent(currentDashboardPath)}`,
        )
      }
      notifications={[]}
      sidebarFooterNote={tShell("footerNote")}
      labels={shellLabels}
      directorySection={{
        navItemId: "contents",
        rootHref: contentsHref,
        activeHref: activeDirectoryHref,
        nodes: directoryNodes,
        expandedIds: effectiveExpandedDirectoryIds,
        onExpandedIdsChange: setExpandedDirectoryIds,
        onCreateDirectory: handleCreateDirectory,
        onRenameDirectory: handleRenameDirectory,
        onDeleteDirectory: handleDeleteDirectory,
        canManageDirectories,
        directoryActionDisabledReason,
        maxNameLength: maxContentDirectoryNameLength,
      }}
    >
      {shellChildren}
    </DashboardShell>
  );
}
