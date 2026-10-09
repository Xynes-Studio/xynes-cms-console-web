import { notFound } from "next/navigation";
import { NestedModalsFixture } from "./NestedModalsFixture";

export default async function ModalLayersFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES !== "1"
  )
    notFound();
  const query = await searchParams;
  return (
    <NestedModalsFixture
      parent={query.parent === "dialog" ? "dialog" : "sheet"}
    />
  );
}
