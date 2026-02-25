"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import {
  buildDashboardSectionPath,
  defaultDashboardSection,
  isDashboardSection,
} from "../../../../src/lib/dashboard/dashboard-section-route";

type DashboardCurrentRouteParams = {
  segments?: string | string[];
};

const toSegmentList = (segments: string | string[] | undefined): string[] => {
  if (Array.isArray(segments)) {
    return segments;
  }

  if (typeof segments === "string" && segments.trim()) {
    return [segments];
  }

  return [];
};

const resolveSectionContext = (segments: string[]) => {
  const [rawSection, ...rawTailSegments] = segments;

  if (!rawSection) {
    return {
      section: defaultDashboardSection,
      tailSegments: [] as string[],
    };
  }

  const normalizedSection = rawSection.trim().toLocaleLowerCase();
  if (!isDashboardSection(normalizedSection)) {
    return {
      section: defaultDashboardSection,
      tailSegments: [] as string[],
    };
  }

  return {
    section: normalizedSection,
    tailSegments: normalizedSection === "content" ? rawTailSegments : [],
  };
};

export default function DashboardCurrentAliasPage() {
  const router = useRouter();
  const params = useParams<DashboardCurrentRouteParams>();
  const {
    isLoading: workspaceLoading,
    currentWorkspace,
    selectWorkspace,
  } = useWorkspace();
  const {
    isAuthenticated,
    isLoading: authLoading,
    redirectToLogin,
    workspaces,
  } = useAuth();

  const isLoading = workspaceLoading || authLoading;

  const fallbackWorkspace = useMemo(
    () =>
      workspaces.find((workspace) =>
        Boolean(
          buildDashboardSectionPath({
            workspaceSlug: workspace?.slug ?? "",
            section: defaultDashboardSection,
          }),
        ),
      ) ?? null,
    [workspaces],
  );

  const currentWorkspaceIsSafe = Boolean(
    buildDashboardSectionPath({
      workspaceSlug: currentWorkspace?.slug ?? "",
      section: defaultDashboardSection,
    }),
  );

  const targetWorkspace = currentWorkspaceIsSafe
    ? currentWorkspace
    : fallbackWorkspace;

  const sectionContext = useMemo(
    () => resolveSectionContext(toSegmentList(params?.segments)),
    [params?.segments],
  );

  const resolvedPath = targetWorkspace?.slug
    ? buildDashboardSectionPath({
        workspaceSlug: targetWorkspace.slug,
        section: sectionContext.section,
        tailSegments: sectionContext.tailSegments,
      })
    : null;

  useEffect(() => {
    if (isLoading || !resolvedPath) {
      return;
    }

    const shouldSyncWorkspace =
      fallbackWorkspace?.id &&
      (!currentWorkspace || !currentWorkspaceIsSafe) &&
      fallbackWorkspace.id !== currentWorkspace?.id;

    if (shouldSyncWorkspace) {
      selectWorkspace(fallbackWorkspace.id);
    }

    router.replace(resolvedPath);
  }, [
    currentWorkspace,
    currentWorkspaceIsSafe,
    fallbackWorkspace,
    isLoading,
    resolvedPath,
    router,
    selectWorkspace,
  ]);

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    redirectToLogin(window.location.href);
  }, [isAuthenticated, isLoading, redirectToLogin]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          Loading dashboard...
        </p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          Redirecting to login...
        </p>
      </main>
    );
  }

  if (!resolvedPath) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section
          role="alert"
          aria-live="assertive"
          className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard not found</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            We could not resolve your last selected workspace for dashboard access.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.06]"
            >
              Go to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
        Redirecting to workspace dashboard...
      </p>
    </main>
  );
}
