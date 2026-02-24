import {
  CmsDashboardShell,
  DashboardComingSoonPanel,
} from "../../../../src/components/dashboard";

export default async function WorkspacePluginsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <CmsDashboardShell workspaceSlug={workspaceSlug}>
      <DashboardComingSoonPanel sectionLabel="Plugins" />
    </CmsDashboardShell>
  );
}
