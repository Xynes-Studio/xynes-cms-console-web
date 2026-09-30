import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  if (process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES !== "1") {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    {
      authenticated: false,
      flags: {},
    },
    { headers: noStoreHeaders },
  );
}
