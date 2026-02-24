"use client";

import type { ComponentProps, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  DashboardShell,
  type DashboardNavItem as LumiaDashboardNavItem,
} from "@lumia-ui/layout";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import { toSafeDashboardPath } from "../../lib/dashboard/workspace-route";
import { getCmsDashboardNavItems } from "./navigation";
import { WorkspaceSelectionSync } from "./WorkspaceSelectionSync";

type CmsDashboardShellProps = {
  children: ReactNode;
  workspaceSlug: string;
};

type LumiaDashboardChildren = ComponentProps<typeof DashboardShell>["children"];

export function CmsDashboardShell({
  children,
  workspaceSlug,
}: CmsDashboardShellProps) {
  const router = useRouter();
  const activePath = usePathname();
  const { user, workspaces, isAuthenticated, isLoading: isAuthLoading, redirectToLogin } =
    useAuth();
  const { currentWorkspace, selectWorkspace } = useWorkspace();

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
  const fallbackDashboardPath = toSafeDashboardPath(workspaceSlug) ?? "/dashboard";
  const currentDashboardPath =
    activePath && activePath.startsWith("/dashboard/") ? activePath : fallbackDashboardPath;

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
      activePath={activePath || fallbackDashboardPath}
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
      onWorkspaceSelect={selectWorkspace}
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
    >
      <WorkspaceSelectionSync workspaceSlug={workspaceSlug} />
      {children as unknown as LumiaDashboardChildren}
    </DashboardShell>
  );
}
