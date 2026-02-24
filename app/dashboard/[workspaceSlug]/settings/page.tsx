import {
  CmsDashboardShell,
  DashboardComingSoonPanel,
} from "../../../../src/components/dashboard";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <CmsDashboardShell workspaceSlug={workspaceSlug}>
      <DashboardComingSoonPanel sectionLabel="Settings" />
    </CmsDashboardShell>
  );
}
