import { notFound } from "next/navigation";
import { IntegrationFixture } from "./IntegrationFixture";

export default async function ContentIntegrationFixturePage({
  searchParams,
}: {
  searchParams: Promise<{
    target?: string;
    state?: string;
    config?: string;
    long?: string;
  }>;
}) {
  // This request-builder fixture must never be exposed by production builds.
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES !== "1"
  )
    notFound();
  const query = await searchParams;
  return (
    <IntegrationFixture
      entry={query.target === "entry"}
      legacy={query.state === "legacy"}
      draft={query.state === "draft"}
      invalid={query.config === "invalid"}
      long={query.long === "1"}
    />
  );
}
