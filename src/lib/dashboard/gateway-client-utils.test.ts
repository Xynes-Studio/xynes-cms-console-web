import { describe, expect, it } from "vitest";
import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

describe("gateway-client-utils", () => {
  it("checks primitive guards correctly", () => {
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);

    expect(isNonEmptyString("docs")).toBe(true);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(1)).toBe(false);
  });

  it("unwraps nested gateway envelopes", () => {
    const result = unwrapGatewayEnvelope({
      ok: true,
      data: {
        ok: true,
        data: [{ id: "1" }],
      },
    });

    expect(result).toEqual([{ id: "1" }]);
  });

  it("normalizes and validates gateway client common inputs", () => {
    expect(
      normalizeGatewayClientInputs({
        apiBaseUrl: " http://localhost:4100/ ",
        workspaceId: " ws-1 ",
        accessToken: " token ",
        errorContext: "content types lookup",
      }),
    ).toEqual({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "ws-1",
      accessToken: "token",
    });
  });

  it("throws for missing required inputs", () => {
    expect(() =>
      normalizeGatewayClientInputs({
        apiBaseUrl: " ",
        workspaceId: "ws-1",
        accessToken: "token",
        errorContext: "content types lookup",
      }),
    ).toThrow(/Missing apiBaseUrl/);

    expect(() =>
      normalizeGatewayClientInputs({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: " ",
        accessToken: "token",
        errorContext: "content types lookup",
      }),
    ).toThrow(/Missing workspaceId/);

    expect(() =>
      normalizeGatewayClientInputs({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "ws-1",
        accessToken: " ",
        errorContext: "content types lookup",
      }),
    ).toThrow(/Missing access token/);
  });
});
