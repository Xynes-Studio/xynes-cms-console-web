import { NextResponse } from "next/server";
import {
  fixtureControlUrl,
  readIntegrationFixture,
  parseFixtureMutation,
  FixtureEntryStateSchema,
} from "../../../../src/lib/testing/cms-integration-fixture";
export async function POST(request: Request) {
  if (!readIntegrationFixture()) return new NextResponse(null, { status: 404 });
  try {
    const raw = await request.text();
    if (raw.length > 1048576) return new NextResponse(null, { status: 413 });
    const payload = parseFixtureMutation(JSON.parse(raw));
    const response = await fetch(fixtureControlUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CMS_INTEGRATIONS_FIXTURE_CONTROL_TOKEN ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return new NextResponse(null, { status: 502 });
    return NextResponse.json(
      FixtureEntryStateSchema.parse(await response.json()),
    );
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
