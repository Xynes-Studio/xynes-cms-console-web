import type { ReactNode } from "react";

/**
 * Editor route layout — full-screen overlay (BUG-CMS-9 documented escape hatch).
 *
 * The CMS editor renders inside `fixed inset-0 z-50 overflow-hidden` so the
 * content writer gets the entire viewport (no sidebar, no shell chrome).
 * This is an intentional UX decision and the single allowed bypass of the
 * Lumia DS `DashboardShell` scroll-containment contract introduced by BUG-LDS-1.
 *
 * See `docs/DEVELOPER.md` → "Dashboard shell contract (BUG-CMS-9)" for the
 * full rationale + allowlist. The `app/dashboard-shell-contract.test.ts`
 * regression test treats this file as the sole `fixed inset-0` allowlist
 * entry and will fail loudly if the overlay disappears or moves.
 */
export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-bug-cms-9="editor-fullscreen-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-background"
    >
      {children}
    </div>
  );
}
