import { notFound } from "next/navigation";
import { Alert } from "@lumia-ui/components";

export default function AlertFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES !== "1"
  )
    notFound();
  return (
    <main className="mx-auto grid max-w-xl gap-4 p-6">
      {(["info", "success", "warning", "error"] as const).map((variant) => (
        <Alert
          key={variant}
          variant={variant}
          title={variant}
          description="Shared semantic colors remain readable in both themes."
          closable
        />
      ))}
    </main>
  );
}
