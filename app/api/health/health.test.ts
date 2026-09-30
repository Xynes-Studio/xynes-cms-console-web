import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultHealthChecker, createHealthChecker } from "./health";

const productionEnvironment = {
  NODE_ENV: "production",
  NEXT_API_URL: "http://gateway.internal:4100",
  XYNES_BUILD_VERSION: "sha-1234567",
};

function okResponse(ok: boolean): Pick<Response, "ok"> {
  return { ok };
}

describe("createHealthChecker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the exact healthy contract after one direct gateway probe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl,
      now: () => 1_000,
      uptime: () => 42.9,
    });

    await expect(checkHealth()).resolves.toEqual({
      status: 200,
      body: {
        ok: true,
        service: "xynes-cms-console-web",
        version: "sha-1234567",
        uptime_seconds: 42,
        checks: { gateway: "ok" },
      },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://gateway.internal:4100/health",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns the exact degraded contract for a non-2xx gateway response", async () => {
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl: vi.fn().mockResolvedValue(okResponse(false)),
      now: () => 1_000,
      uptime: () => 0,
    });

    await expect(checkHealth()).resolves.toEqual({
      status: 503,
      body: {
        ok: false,
        service: "xynes-cms-console-web",
        version: "sha-1234567",
        uptime_seconds: 0,
        checks: { gateway: "fail" },
      },
    });
  });

  it("fails closed when the gateway request throws without leaking the error", async () => {
    const secret = "xynes_live_do-not-leak";
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl: vi.fn().mockRejectedValue(
        new Error(`request to http://gateway.internal:4100 failed: ${secret}`),
      ),
      now: () => 1_000,
      uptime: () => 7,
    });

    const result = await checkHealth();
    expect(result.status).toBe(503);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("gateway.internal");
    expect(Object.keys(result.body).sort()).toEqual(
      ["checks", "ok", "service", "uptime_seconds", "version"].sort(),
    );
    expect(Object.keys(result.body.checks)).toEqual(["gateway"]);
  });

  it("aborts a hanging probe after the hard one-second timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Pick<Response, "ok">>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl,
      now: () => 1_000,
      uptime: () => 3,
    });

    const resultPromise = checkHealth();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(resultPromise).resolves.toMatchObject({
      status: 503,
      body: { ok: false, checks: { gateway: "fail" } },
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("caches failed probes for 30 seconds and retries at expiry", async () => {
    let now = 10_000;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okResponse(false))
      .mockResolvedValueOnce(okResponse(true));
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl,
      now: () => now,
      uptime: () => 1,
    });

    expect((await checkHealth()).status).toBe(503);
    now += 29_999;
    expect((await checkHealth()).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledOnce();

    now += 1;
    expect((await checkHealth()).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache successful probes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    await checkHealth();
    await checkHealth();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight probe across concurrent health requests", async () => {
    let resolveProbe: ((response: Pick<Response, "ok">) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Pick<Response, "ok">>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    const first = checkHealth();
    const second = checkHealth();
    expect(fetchImpl).toHaveBeenCalledOnce();

    resolveProbe?.(okResponse(true));
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
    ]);
  });

  it("uses the public gateway URL only outside production", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: {
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4100/",
      },
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    await expect(checkHealth()).resolves.toMatchObject({
      status: 200,
      body: { version: "dev" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:4100/health",
      expect.any(Object),
    );
  });

  it("fails closed without probing when production server configuration is absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://public.example.test",
        XYNES_BUILD_VERSION: "sha-1234567",
      },
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    await expect(checkHealth()).resolves.toMatchObject({
      status: 503,
      body: { ok: false, checks: { gateway: "fail" } },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed with an explicit marker when a production version is absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: {
        NODE_ENV: "production",
        NEXT_API_URL: "https://gateway.example.test",
        XYNES_BUILD_VERSION: "   ",
      },
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    await expect(checkHealth()).resolves.toMatchObject({
      status: 503,
      body: { version: "unconfigured", checks: { gateway: "fail" } },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "not-a-url",
    "https://user:password@gateway.example.test",
    "https://gateway.example.test?token=secret",
    "https://gateway.example.test#internal",
  ])("rejects unsafe gateway URL %s without a network request", async (gatewayUrl) => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(true));
    const checkHealth = createHealthChecker({
      env: { ...productionEnvironment, NEXT_API_URL: gatewayUrl },
      fetchImpl,
      now: () => 1_000,
      uptime: () => 1,
    });

    await expect(checkHealth()).resolves.toMatchObject({ status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes invalid uptime values to a non-negative integer", async () => {
    const checkHealth = createHealthChecker({
      env: productionEnvironment,
      fetchImpl: vi.fn().mockResolvedValue(okResponse(true)),
      now: () => 1_000,
      uptime: () => Number.NaN,
    });

    expect((await checkHealth()).body.uptime_seconds).toBe(0);
  });

  it("wires the default platform fetch, clock, and uptime dependencies", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    vi.spyOn(process, "uptime").mockReturnValue(12.8);
    const checkHealth = createDefaultHealthChecker(productionEnvironment);

    await expect(checkHealth()).resolves.toMatchObject({
      status: 200,
      body: { uptime_seconds: 12, checks: { gateway: "ok" } },
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
