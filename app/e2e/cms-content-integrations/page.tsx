import { notFound } from "next/navigation";
import { IntegrationHostsFixture } from "../content-integration-hosts/IntegrationHostsFixture";
import {
  readIntegrationFixture,
  fixtureControlUrl,
  FixtureEntryStateSchema,
} from "../../../src/lib/testing/cms-integration-fixture";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ host?: string; folder?: string; entry?: string }>;
}) {
  const live = readIntegrationFixture();
  if (!live) notFound();
  const query = await searchParams;
  const host =
    query.host === "editor" || query.host === "grid" ? query.host : "list";
  const response = await fetch(fixtureControlUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CMS_INTEGRATIONS_FIXTURE_CONTROL_TOKEN ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "state", legacy: query.entry === "legacy" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Isolated fixture state unavailable");
  const state = FixtureEntryStateSchema.parse(await response.json());
  return (
    <IntegrationHostsFixture
      host={host}
      disabled={false}
      live={live}
      initialState={state}
      folder={
        query.folder === "empty"
          ? "empty"
          : query.folder === "moved"
            ? "moved"
            : "news"
      }
      legacy={query.entry === "legacy"}
    />
  );
}
