import { CmsContentListPanel } from "../../../../../src/features/cms-content/CmsContentListPanel";
import { CmsEditorScreen } from "../../../../../src/features/cms-content/CmsEditorScreen";

type WorkspaceNestedContentPageProps = {
  params: Promise<{
    workspaceSlug: string;
    segments: string[];
  }>;
};

function isEditorRouteSegments(segments: string[]): segments is [string, string, string] {
  return (
    segments.length === 3 &&
    segments[0] === "entry" &&
    Boolean(segments[1]?.trim()) &&
    segments[2] === "edit"
  );
}

export default async function WorkspaceNestedContentPage({
  params,
}: WorkspaceNestedContentPageProps) {
  const { workspaceSlug, segments } = await params;

  if (isEditorRouteSegments(segments)) {
    return <CmsEditorScreen entryId={segments[1]} workspaceSlug={workspaceSlug} />;
  }

  return <CmsContentListPanel />;
}
