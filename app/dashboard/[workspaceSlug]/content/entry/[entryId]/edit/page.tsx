import { CmsEditorScreen } from "../../../../../../../src/features/cms-content/CmsEditorScreen";

export default async function ContentEntryEditPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; entryId: string }>;
}) {
  const { workspaceSlug, entryId } = await params;

  return <CmsEditorScreen entryId={entryId} workspaceSlug={workspaceSlug} />;
}
