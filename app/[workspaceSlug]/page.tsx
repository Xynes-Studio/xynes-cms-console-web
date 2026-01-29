import Link from "next/link";

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Workspace: {workspaceSlug}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This is the CMS Console entry route for a workspace. The full
              console UI can live under this workspace slug.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.06]"
          >
            Home
          </Link>
        </div>

        <div className="mt-8 grid gap-3">
          <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-white/[.04] dark:text-zinc-300">
            Next steps: add routes like <code className="font-mono">/{workspaceSlug}/content</code>{" "}
            or <code className="font-mono">/{workspaceSlug}/documents</code>.
          </div>
        </div>
      </div>
    </main>
  );
}

