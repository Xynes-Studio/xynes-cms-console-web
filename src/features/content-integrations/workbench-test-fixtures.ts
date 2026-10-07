import type { IntegrationContext } from "./types";
export const folderContext: IntegrationContext = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceSlug: "editorial",
  apiBaseUrl: "https://api.xynes.com",
  target: {
    kind: "directory",
    directoryId: "22222222-2222-4222-8222-222222222222",
    label: "News",
    breadcrumb: "Content / News",
  },
};
export const entryContext: IntegrationContext = {
  ...folderContext,
  target: {
    kind: "entry",
    entryId: "33333333-3333-4333-8333-333333333333",
    label: "First story",
  },
};
