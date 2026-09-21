import { NextResponse } from "next/server";
import { getCmsHealthStatus } from "./health";

export async function GET() {
  const result = await getCmsHealthStatus();

  return NextResponse.json(
    result.body,
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
