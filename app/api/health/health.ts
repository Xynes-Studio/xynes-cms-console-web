const SERVICE_NAME = "xynes-cms-console-web";
const DEFAULT_PROBE_TIMEOUT_MS = 1_000;
const DEFAULT_FAILURE_CACHE_MS = 30_000;

type GatewayStatus = "ok" | "fail";

export interface CmsHealthBody {
  ok: boolean;
  service: typeof SERVICE_NAME;
  version: string;
  uptime_seconds: number;
  checks: {
    gateway: GatewayStatus;
  };
}

export interface CmsHealthResult {
  status: 200 | 503;
  body: CmsHealthBody;
}

type HealthFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "ok">>;

interface HealthEnvironment {
  NODE_ENV?: string;
  NEXT_API_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
  XYNES_BUILD_VERSION?: string;
}

interface HealthCheckerDependencies {
  env: HealthEnvironment;
  fetchImpl: HealthFetch;
  now: () => number;
  uptime: () => number;
  probeTimeoutMs?: number;
  failureCacheMs?: number;
}

interface RuntimeConfiguration {
  gatewayHealthUrl: string | null;
  version: string;
  valid: boolean;
}

function normalizeGatewayHealthUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return `${url.toString().replace(/\/$/, "")}/health`;
  } catch {
    return null;
  }
}

function resolveRuntimeConfiguration(
  env: HealthEnvironment,
): RuntimeConfiguration {
  const production = env.NODE_ENV === "production";
  const gatewayBaseUrl =
    env.NEXT_API_URL ?? (production ? undefined : env.NEXT_PUBLIC_API_URL);
  const gatewayHealthUrl = normalizeGatewayHealthUrl(gatewayBaseUrl);
  const configuredVersion = env.XYNES_BUILD_VERSION?.trim();
  const version = configuredVersion || (production ? "unconfigured" : "dev");

  return {
    gatewayHealthUrl,
    version,
    valid: Boolean(gatewayHealthUrl && (!production || configuredVersion)),
  };
}

function normalizeUptime(uptime: number): number {
  return Number.isFinite(uptime) && uptime > 0 ? Math.floor(uptime) : 0;
}

function createResult(
  gateway: GatewayStatus,
  version: string,
  uptime: number,
): CmsHealthResult {
  const ok = gateway === "ok";
  return {
    status: ok ? 200 : 503,
    body: {
      ok,
      service: SERVICE_NAME,
      version,
      uptime_seconds: normalizeUptime(uptime),
      checks: { gateway },
    },
  };
}

export function createHealthChecker({
  env,
  fetchImpl,
  now,
  uptime,
  probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  failureCacheMs = DEFAULT_FAILURE_CACHE_MS,
}: HealthCheckerDependencies): () => Promise<CmsHealthResult> {
  const runtime = resolveRuntimeConfiguration(env);
  let failedUntil = 0;
  let inFlight: Promise<CmsHealthResult> | null = null;

  const probeGateway = async (): Promise<CmsHealthResult> => {
    if (!runtime.valid || !runtime.gatewayHealthUrl) {
      failedUntil = now() + failureCacheMs;
      return createResult("fail", runtime.version, uptime());
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      probeTimeoutMs,
    );

    let response: Pick<Response, "ok">;
    try {
      response = await fetchImpl(runtime.gatewayHealthUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      globalThis.clearTimeout(timeout);
      failedUntil = now() + failureCacheMs;
      return createResult("fail", runtime.version, uptime());
    }

    globalThis.clearTimeout(timeout);
    const gatewayStatus: GatewayStatus = response.ok ? "ok" : "fail";
    if (gatewayStatus === "fail") {
      failedUntil = now() + failureCacheMs;
    }
    return createResult(gatewayStatus, runtime.version, uptime());
  };

  return () => {
    if (now() < failedUntil) {
      return Promise.resolve(createResult("fail", runtime.version, uptime()));
    }

    if (inFlight) return inFlight;

    inFlight = probeGateway().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

export function createDefaultHealthChecker(
  env: HealthEnvironment = process.env,
): () => Promise<CmsHealthResult> {
  return createHealthChecker({
    env,
    fetchImpl: (input, init) => fetch(input, init),
    now: () => Date.now(),
    uptime: () => process.uptime(),
  });
}

export const getCmsHealthStatus = createDefaultHealthChecker();
