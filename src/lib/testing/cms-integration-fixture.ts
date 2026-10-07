import { z } from "zod";

const loopbackOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port !== "" &&
      url.origin === value
    );
  } catch {
    return false;
  }
});
export const IntegrationFixtureSchema = z.strictObject({
  gatewayOrigin: loopbackOrigin,
  workspaceId: z.string().uuid(),
  directoryId: z.string().uuid(),
  emptyDirectoryId: z.string().uuid(),
  movedDirectoryId: z.string().uuid(),
  entryId: z.string().uuid(),
  legacyEntryId: z.string().uuid(),
  childEntryId: z.string().uuid(),
  foreignWorkspaceId: z.string().uuid(),
  foreignEntryId: z.string().uuid(),
});
export type IntegrationFixtureContext = z.infer<
  typeof IntegrationFixtureSchema
>;
function enabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES === "1" &&
    process.env.RUN_CMS_INTEGRATIONS_BROWSER === "1"
  );
}
export function readIntegrationFixture(): IntegrationFixtureContext | null {
  if (!enabled()) return null;
  try {
    const raw = process.env.CMS_INTEGRATIONS_FIXTURE_CONTEXT ?? "";
    if (raw.length > 8192) throw new Error();
    return IntegrationFixtureSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Invalid isolated integration fixture");
  }
}
export function fixtureControlUrl(): string {
  if (!enabled()) throw new Error("Isolated integration fixture disabled");
  const origin = loopbackOrigin.safeParse(
    process.env.CMS_INTEGRATIONS_FIXTURE_CONTROL_ORIGIN,
  );
  if (!origin.success) throw new Error("Invalid isolated control origin");
  return `${origin.data}/control`;
}
const mutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save"),
    title: z.string().trim().min(1).max(200),
    body: z.unknown().optional(),
  }),
  z.strictObject({
    action: z.enum([
      "publish",
      "archive",
      "unpublish",
      "move",
      "legacyRepublish",
    ]),
  }),
]);
export function parseFixtureMutation(payload: unknown) {
  if (JSON.stringify(payload)?.length > 1048576)
    throw new Error("Fixture mutation too large");
  return mutationSchema.parse(payload);
}
export const FixtureEditorBodySchema = z.strictObject({
  root: z
    .object({
      children: z.array(
        z.object({ type: z.string(), version: z.number().int() }).passthrough(),
      ),
      direction: z.enum(["ltr", "rtl"]).nullable(),
      format: z.enum([
        "",
        "left",
        "start",
        "center",
        "right",
        "end",
        "justify",
      ]),
      indent: z.number().int(),
      type: z.literal("root"),
      version: z.literal(1),
    })
    .passthrough(),
});
export const FixtureEntryStateSchema = z.strictObject({
  deliveryState: z.enum(["available", "unpublished", "republish_required"]),
  body: FixtureEditorBodySchema,
  title: z.string(),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  directoryId: z.string().uuid().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type FixtureEntryState = z.infer<typeof FixtureEntryStateSchema>;
