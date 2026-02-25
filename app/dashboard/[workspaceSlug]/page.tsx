import { redirect } from "next/navigation";
import { buildDashboardSectionPath } from "../../../src/lib/dashboard/dashboard-section-route";

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const targetPath =
    buildDashboardSectionPath({
      workspaceSlug,
      section: "content",
    }) ?? "/dashboard";

  redirect(targetPath);
}
