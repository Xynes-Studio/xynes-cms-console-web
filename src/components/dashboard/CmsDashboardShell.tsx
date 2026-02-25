"use client";

import type { ComponentProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DashboardShell,
  type DashboardNavItem as LumiaDashboardNavItem,
} from "@lumia-ui/layout";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import {
  addContentDirectory,
  getContentDirectoryPathIds,
  getContentDirectoryPathSegment,
  maxContentDirectoryNameLength,
  materializePersistedContentDirectories,
  type ContentDirectoryNode,
} from "../../lib/dashboard/content-directory-tree";
import {
  createWorkspaceContentDirectory,
  listWorkspaceContentDirectories,
} from "../../lib/dashboard/content-directories-client";
import {
  listWorkspaceContentTypes,
  mapContentTypesToDirectoryNodes,
} from "../../lib/dashboard/content-types-client";
import {
  buildDashboardSectionPath,
  defaultDashboardSection,
  parseDashboardSectionPath,
} from "../../lib/dashboard/dashboard-section-route";
import { getCmsDashboardNavItems } from "./navigation";
import { WorkspaceSelectionSync } from "./WorkspaceSelectionSync";

type CmsDashboardShellProps = {
  children: LumiaDashboardChildren;
  workspaceSlug: string;
};

type LumiaDashboardChildren = ComponentProps<typeof DashboardShell>["children"];

type ContentTreeNavNode = ContentDirectoryNode & {
  href: string;
  children?: ContentTreeNavNode[];
};

const createRouteDirectoryId = (pathSegments: string[]) =>
  `content-path-${pathSegments.join("--")}`;

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

export function CmsDashboardShell({
  children,
  workspaceSlug,
}: CmsDashboardShellProps) {
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

        const [contentTypes, persistedDirectories] = await Promise.all([
          listWorkspaceContentTypes({
            apiBaseUrl,
            workspaceId: contentDirectoryWorkspaceId,
            accessToken,
            signal: abortController.signal,
          }),
          listWorkspaceContentDirectories({
            apiBaseUrl,
            workspaceId: contentDirectoryWorkspaceId,
            accessToken,
            signal: abortController.signal,
          }),
        ]);
        if (abortController.signal.aborted) {
          return;
        }

        const apiDirectoryNodes = materializePersistedContentDirectories({
          baseNodes: mapContentTypesToDirectoryNodes(contentTypes),
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

  const navItems: LumiaDashboardNavItem[] = getCmsDashboardNavItems(workspaceSlug).map(
    (item) => ({
      id: item.key,
      label: item.label,
      href: item.href,
      icon: item.icon,
    }),
  );
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

    if (isAuthLoading || !isAuthenticated || !contentDirectoryWorkspaceId) {
      return;
    }

    if (input.parentId?.startsWith("content-path-")) {
      return;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (!apiBaseUrl) {
      return;
    }

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          return;
        }

        await createWorkspaceContentDirectory({
          apiBaseUrl,
          workspaceId: contentDirectoryWorkspaceId,
          accessToken,
          parentId: input.parentId,
          name: input.name,
        });
        setDirectoryDataRevision((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to persist workspace content directory", error);
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

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          Loading dashboard...
        </p>
      </main>
    );
  }

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          Redirecting to login...
        </p>
      </main>
    );
  }

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
      onCreateWorkspace={() => router.push("/onboarding")}
      enableWorkspaceCreation={true}
      userMenu={{
        name: user?.displayName || user?.email || "User",
        email: user?.email || "No email",
        avatarSrc: user?.avatarUrl || undefined,
      }}
      onLogout={() => router.push(`/logout?redirect=${encodeURIComponent(currentDashboardPath)}`)}
      notifications={[]}
      sidebarFooterNote="Need access? Contact your workspace owner."
      directorySection={{
        navItemId: "contents",
        rootHref: contentsHref,
        activeHref: activeDirectoryHref,
        nodes: directoryNodes,
        expandedIds: effectiveExpandedDirectoryIds,
        onExpandedIdsChange: setExpandedDirectoryIds,
        onCreateDirectory: handleCreateDirectory,
        maxNameLength: maxContentDirectoryNameLength,
      }}
    >
      <WorkspaceSelectionSync workspaceSlug={workspaceSlug} />
      {children}
    </DashboardShell>
  );
}
