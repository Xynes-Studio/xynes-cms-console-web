import { notFound } from "next/navigation";
import { IntegrationHostsFixture } from "./IntegrationHostsFixture";
export default async function IntegrationHostsPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string; disabled?: string; long?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES !== "1"
  )
    notFound();
  const query = await searchParams;
  const host =
    query.host === "grid" || query.host === "editor" || query.host === "root"
      ? query.host
      : "list";
  return (
    <IntegrationHostsFixture
      host={host}
      disabled={query.disabled === "1"}
      long={query.long === "1"}
    />
  );
}
