"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import { toSafeDashboardPath } from "../../src/lib/dashboard/workspace-route";

export default function DashboardResolverPage() {
  const router = useRouter();
  const {
    isLoading: workspaceLoading,
    currentWorkspace,
    selectWorkspace,
  } = useWorkspace();
  const { isLoading: authLoading, workspaces } = useAuth();
  const isLoading = workspaceLoading || authLoading;
  const fallbackWorkspace = workspaces.find((workspace) =>
    Boolean(toSafeDashboardPath(workspace?.slug)),
  );
  const resolvedPath = useMemo(
    () =>
      toSafeDashboardPath(currentWorkspace?.slug) ??
      toSafeDashboardPath(fallbackWorkspace?.slug),
    [currentWorkspace?.slug, fallbackWorkspace?.slug],
  );

  useEffect(() => {
    if (isLoading || !resolvedPath) {
      return;
    }

    if (!currentWorkspace && fallbackWorkspace?.id) {
      selectWorkspace(fallbackWorkspace.id);
    }
    router.replace(resolvedPath);
  }, [
    currentWorkspace,
    fallbackWorkspace?.id,
    isLoading,
    resolvedPath,
    router,
    selectWorkspace,
  ]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          Loading dashboard...
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
