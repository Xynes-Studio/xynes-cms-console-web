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
  ensureContentDirectoryPath,
  getContentDirectoryPathIds,
  getContentDirectoryPathSegment,
  maxContentDirectoryNameLength,
  type ContentDirectoryNode,
} from "../../lib/dashboard/content-directory-tree";
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
  const { user, workspaces, isAuthenticated, isLoading: isAuthLoading, redirectToLogin } =
    useAuth();
  const { currentWorkspace } = useWorkspace();
  const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();
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
  const initialDirectoryTree = ensureContentDirectoryPath({
    nodes: [],
    pathSegments: activeContentTailSegments,
    createId: createRouteDirectoryId,
  });
  const [contentDirectories, setContentDirectories] = useState<ContentDirectoryNode[]>(
    initialDirectoryTree,
  );
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
  const materializedContentDirectories = useMemo(
    () =>
      ensureContentDirectoryPath({
        nodes: contentDirectories,
        pathSegments: activeContentTailSegments,
        createId: createRouteDirectoryId,
      }),
    [activeContentTailSegments, contentDirectories],
  );

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
    setContentDirectories((previous) =>
      addContentDirectory({
        nodes: ensureContentDirectoryPath({
          nodes: previous,
          pathSegments: activeContentTailSegments,
          createId: createRouteDirectoryId,
        }),
        parentId: input.parentId,
        rawName: input.name,
      }),
    );
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
        expandedIds: expandedDirectoryIds,
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
