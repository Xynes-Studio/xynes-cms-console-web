# CMS-UI-007 Lumia Editor Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder CMS editor canvas with Lumia DS rich-text editing, persist `body` JSON through existing entry update APIs, and document the deferred media-upload gap as tech debt.

**Architecture:** Keep the route file thin and preserve `CmsEditorScreen` as the orchestration container. Add one pure helper module for Lumia body normalization and draft comparison, render the Lumia editor inside `CmsEditorLayout`, and extend the existing autosave/publish flow to include `body` without changing backend contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, React Testing Library, Lumia DS, `@lumia-ui/editor`, existing CMS gateway client hooks.

---

### Task 1: Link the Lumia editor package into the CMS app

**Files:**
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/package.json`

**Step 1: Write the failing test**

No new test for dependency wiring. Use the existing app import boundary as the failure signal.

**Step 2: Run test or type import to verify it fails**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
node -e "import('@lumia-ui/editor').catch(() => process.exit(1))"
```

Expected: import fails because `@lumia-ui/editor` is not declared in the CMS app.

**Step 3: Write minimal implementation**

Add a linked dependency:

```json
"@lumia-ui/editor": "link:../lumia-ds/packages/editor"
```

**Step 4: Build linked Lumia editor package and verify import**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/lumia-ds
pnpm --filter @lumia-ui/editor build

cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
node -e "import('@lumia-ui/editor').then(() => process.exit(0)).catch(() => process.exit(1))"
```

Expected: build succeeds and import resolves.

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/package.json
git commit -m "build: link Lumia editor package"
```

### Task 2: Add pure editor body normalization helpers

**Files:**
- Create: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/cms-editor-body.ts`
- Test: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/cms-editor-body.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  createEmptyLumiaDocument,
  normalizeEditorBody,
  hasEditorDraftChanged,
} from "./cms-editor-body";

describe("normalizeEditorBody", () => {
  it("returns an empty Lumia document when body is null", () => {
    expect(normalizeEditorBody(null)).toEqual(createEmptyLumiaDocument());
  });

  it("returns an empty Lumia document when body is malformed", () => {
    expect(normalizeEditorBody({ bad: true })).toEqual(createEmptyLumiaDocument());
  });

  it("preserves valid Lumia editor JSON", () => {
    const value = createEmptyLumiaDocument();
    expect(normalizeEditorBody(value)).toEqual(value);
  });
});

describe("hasEditorDraftChanged", () => {
  it("detects changes in body JSON", () => {
    const before = {
      title: "A",
      description: "",
      tags: "",
      body: createEmptyLumiaDocument(),
    };
    const after = {
      ...before,
      body: {
        root: {
          ...before.body.root,
          children: [
            {
              type: "paragraph",
              version: 1,
              direction: null,
              format: "",
              indent: 0,
              children: [{ type: "text", text: "Hello", version: 1, detail: 0, format: 0, mode: "normal", style: "" }],
            },
          ],
        },
      },
    };

    expect(hasEditorDraftChanged(before, after)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/features/cms-content/cms-editor-body.test.ts
```

Expected: FAIL because the helper module does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- `createEmptyLumiaDocument()`
- `normalizeEditorBody(value)`
- `hasEditorDraftChanged(previous, next)`

Use a fail-closed shape check:

```ts
const isValidLumiaDocument = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "root" in value &&
      value.root &&
      typeof value.root === "object" &&
      Array.isArray((value.root as { children?: unknown }).children),
  );
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/features/cms-content/cms-editor-body.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/cms-editor-body.ts /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/cms-editor-body.test.ts
git commit -m "feat: add CMS editor body normalization helpers"
```

### Task 3: Replace the placeholder canvas in `CmsEditorLayout`

**Files:**
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/components/dashboard/CmsEditorLayout.tsx`
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/components/dashboard/CmsEditorLayout.test.tsx`

**Step 1: Write the failing test**

Add assertions that:

```ts
it("renders editor canvas content and does not show placeholder text", () => {
  render(
    <CmsEditorLayout {...buildProps()}>
      <div data-testid="lumia-editor-host">Editor Body</div>
    </CmsEditorLayout>,
  );

  expect(screen.getByTestId("lumia-editor-host")).toBeInTheDocument();
  expect(
    screen.queryByText("Editor canvas — rich text support coming soon"),
  ).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/components/dashboard/CmsEditorLayout.test.tsx
```

Expected: FAIL because the current layout still expects placeholder behavior.

**Step 3: Write minimal implementation**

- Keep metadata/actions as-is.
- Ensure the `children` area is the real canvas host.
- Remove placeholder-only copy from the render path.
- Preserve `aria-label="Content editor canvas"`.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/components/dashboard/CmsEditorLayout.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/components/dashboard/CmsEditorLayout.tsx /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/components/dashboard/CmsEditorLayout.test.tsx
git commit -m "feat: mount real editor canvas in CMS editor layout"
```

### Task 4: Integrate Lumia editor in `CmsEditorScreen` with autosave body persistence

**Files:**
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/CmsEditorScreen.tsx`
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/CmsEditorScreen.test.tsx`
- Reference: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/lib/dashboard/content-entries-client.ts`
- Reference: `/Users/archanray/xynes-erp/xynes-front-end/lumia-ds/packages/editor/README.md`

**Step 1: Write the failing test**

Update `CmsEditorScreen.test.tsx` to cover:

```ts
it("renders Lumia editor content instead of the placeholder", async () => {
  mockGetWorkspaceContentEntryById.mockResolvedValue(
    makeEntry({ body: createEmptyLumiaDocument() }),
  );

  render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

  await waitFor(() => {
    expect(screen.getByTestId("lumia-editor")).toBeInTheDocument();
  });

  expect(screen.queryByTestId("editor-canvas-placeholder")).toBeNull();
});

it("includes body in autosave payloads", async () => {
  render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

  await waitFor(() => {
    expect(mockCaptureSaveDraftFn).toHaveBeenCalled();
  });

  const saveDraft = mockCaptureSaveDraftFn.mock.calls.at(-1)?.[0];
  await saveDraft({
    title: "My Post",
    description: "A description",
    tags: "news, cms",
    body: createEmptyLumiaDocument(),
  });

  expect(mockUpdateWorkspaceContentEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        body: createEmptyLumiaDocument(),
      }),
    }),
  );
});
```

Also add a failing test for malformed body fallback:

```ts
it("falls back to an empty Lumia document when entry body is malformed", async () => {
  mockGetWorkspaceContentEntryById.mockResolvedValue(
    makeEntry({ body: { broken: true } }),
  );

  render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

  await waitFor(() => {
    expect(screen.getByTestId("lumia-editor")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/features/cms-content/CmsEditorScreen.test.tsx
```

Expected: FAIL because the placeholder is still present and autosave ignores `body`.

**Step 3: Write minimal implementation**

- Import `LumiaEditor` from `@lumia-ui/editor`.
- Extend the draft state to include `body`.
- Seed `body` using `normalizeEditorBody(entry.body)`.
- Update `saveDraftFn` payload:

```ts
payload: {
  title: value.title,
  description: value.description,
  tags: trimmedTags,
  body: value.body,
}
```

- Render the editor inside `CmsEditorLayout`:

```tsx
<LumiaEditor
  value={draft.body}
  onChange={(value) => setDraft((prev) => ({ ...prev, body: value }))}
  variant="full"
/>
```

- Do not provide a `media` upload adapter in this story.
- Replace JSON-stringify draft comparison with helper-based body-aware comparison.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/features/cms-content/CmsEditorScreen.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/CmsEditorScreen.tsx /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web/src/features/cms-content/CmsEditorScreen.test.tsx
git commit -m "feat: wire Lumia editor into CMS editor screen"
```

### Task 5: Update story documentation with explicit tech debt

**Files:**
- Modify: `/Users/archanray/xynes-erp/xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md`

**Step 1: Write the failing test**

No automated test. Documentation change only.

**Step 2: Verify current doc gap**

Run:

```bash
rg -n "media upload|tech debt|CMS-UI-007" /Users/archanray/xynes-erp/xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md
```

Expected: `CMS-UI-007` exists, but no explicit media-upload tech debt note is recorded.

**Step 3: Write minimal implementation**

Add a short note under `CMS-UI-007` or a dedicated follow-up section stating:
- rich-text body editing is enabled
- media upload remains deferred
- missing pieces are gateway/platform-config/cms-core upload contract plus bucket provisioning

**Step 4: Verify the doc update**

Run:

```bash
rg -n "media upload|bucket|gateway|platform-config|cms-core" /Users/archanray/xynes-erp/xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md
```

Expected: explicit tech debt note is present.

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md
git commit -m "docs: record CMS editor media upload tech debt"
```

### Task 6: Final verification before completion

**Files:**
- Verify touched files from Tasks 1-5

**Step 1: Run targeted tests**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test -- src/features/cms-content/cms-editor-body.test.ts src/components/dashboard/CmsEditorLayout.test.tsx src/features/cms-content/CmsEditorScreen.test.tsx
```

Expected: all targeted tests PASS.

**Step 2: Run lint**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm lint
```

Expected: exit code 0.

**Step 3: Run coverage for touched modules**

Run:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
pnpm test:coverage
```

Expected: touched editor modules are at or above 80% statements and branches.

**Step 4: Review requirements against the spec**

Check:
- real Lumia editor is mounted
- placeholder removed
- body persists through update API
- publish still works
- media upload deferred and documented
- no backend contract assumptions added client-side

**Step 5: Commit**

```bash
git add /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web /Users/archanray/xynes-erp/xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md
git commit -m "feat: complete CMS-UI-007 Lumia editor integration"
```
