import type { ReactNode } from "react";
import { CmsDashboardShell } from "../../../src/components/dashboard";

export default async function WorkspaceDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return <CmsDashboardShell workspaceSlug={workspaceSlug}>{children}</CmsDashboardShell>;
}
