import { CmsIntegrationsPanel } from "../../../../src/features/integrations/CmsIntegrationsPanel";

type WorkspaceIntegrationsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

/**
 * Workspace Admin integrations route — CMS contextual surface.
 *
 * Owns: nothing beyond awaiting Next.js 15+ async `params` and forwarding
 * `workspaceSlug` to the client panel. All UX, fetch orchestration, and
 * security policy live in `src/features/integrations/CmsIntegrationsPanel`.
 *
 * Per the Workspace Admin integrations epic, this page MUST remain a thin
 * orchestrator: do not introduce data fetching, env reads, or lifecycle
 * forms here.
 */
export default async function WorkspaceIntegrationsPage({
  params,
}: WorkspaceIntegrationsPageProps) {
  const { workspaceSlug } = await params;

  return <CmsIntegrationsPanel workspaceSlug={workspaceSlug} />;
}
