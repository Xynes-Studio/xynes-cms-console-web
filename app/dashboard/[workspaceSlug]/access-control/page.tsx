import {
  CmsDashboardShell,
  DashboardComingSoonPanel,
} from "../../../../src/components/dashboard";

export default async function WorkspaceAccessControlPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <CmsDashboardShell workspaceSlug={workspaceSlug}>
      <DashboardComingSoonPanel sectionLabel="Access Control" />
    </CmsDashboardShell>
  );
}
