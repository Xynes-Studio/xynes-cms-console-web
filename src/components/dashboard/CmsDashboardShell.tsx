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

function buildAuthWorkspaceCreationUrl(): string {
  const authAppUrl = process.env.NEXT_PUBLIC_AUTH_APP_URL?.trim();
  if (!authAppUrl) {
    return authWorkspaceCreationPath;
  }

  return `${authAppUrl.replace(/\/+$/, "")}${authWorkspaceCreationPath}`;
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
  const { currentWorkspace } = useWorkspace();
  const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();
  const workspaceBySlug = useMemo(
    () =>
      workspaces.find(
        (workspace) => workspace.slug.trim().toLowerCase() === normalizedWorkspaceSlug,
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
    activePath && activePath.startsWith("/dashboard/") ? activePath : fallbackContentPath;
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
          console.error("Failed to load workspace content directory tree", error);
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

  const navItems: LumiaDashboardNavItem[] = getCmsDashboardNavItems(workspaceSlug, {
    contents: t("nav.contents"),
    plugins: t("nav.plugins"),
    "access-control": t("nav.accessControl"),
    integrations: t("nav.integrations"),
    settings: t("nav.settings"),
  }).map((item) => ({
      id: item.key,
      label: item.label,
      href: item.href,
      icon: item.icon,
    }));
  const contentsHref =
    navItems.find((item) => item.id === "contents")?.href ?? fallbackContentPath;
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
      ? buildDashboardSectionPath({
          workspaceSlug: normalizedWorkspaceSlug,
          section: "content",
          tailSegments: activeContentTailSegments,
        }) ?? undefined
      : undefined;

  const handleCreateDirectory = (input: { parentId: string | null; name: string }) => {
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
        console.error("Failed to persist workspace content directory rename", error);
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
        console.error("Failed to persist workspace content directory delete", error);
        setContentDirectories(previousTree);
        setExpandedDirectoryIds(previousExpandedIds);
        notifyDirectoryActionFailed(t("directory.deleteFailedTitle"));
        setDirectoryDataRevision((previous) => previous + 1);
      }
    })();
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
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
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {tStatus("loadingDashboard")}
        </p>
      </main>
    );
  }

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {tStatus("redirectingToLogin")}
        </p>
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
        name: user?.displayName || user?.email || tShellUserMenu("fallbackName"),
        email: user?.email || tShellUserMenu("fallbackEmail"),
        avatarSrc: user?.avatarUrl || undefined,
      }}
      onLogout={() => router.push(`/logout?redirect=${encodeURIComponent(currentDashboardPath)}`)}
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
