"use client";

import { useEffect } from "react";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";

type WorkspaceSelectionSyncProps = {
  workspaceSlug: string;
};

export function WorkspaceSelectionSync({
  workspaceSlug,
}: WorkspaceSelectionSyncProps) {
  const { workspaces } = useAuth();
  const { currentWorkspace, selectWorkspace } = useWorkspace();

  useEffect(() => {
    const targetSlug = workspaceSlug.trim().toLowerCase();
    const currentSlug = currentWorkspace?.slug?.trim().toLowerCase();

    if (!targetSlug || currentSlug === targetSlug) {
      return;
    }

    const matchingWorkspace = workspaces.find(
      (workspace) => workspace.slug?.trim().toLowerCase() === targetSlug,
    );

    if (matchingWorkspace?.id) {
      selectWorkspace(matchingWorkspace.id);
    }
  }, [currentWorkspace?.slug, selectWorkspace, workspaceSlug, workspaces]);

  return null;
}
