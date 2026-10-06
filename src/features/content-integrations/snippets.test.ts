import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntegrationRequest } from "./build-request";
import { buildRequestSnippets } from "./snippets";
const context = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceSlug: "fixture",
  apiBaseUrl: "https://api.example.com/a'b",
  target: { kind: "entry", entryId: "33333333-3333-4333-8333-333333333333", label: "title" },
};
function snippets(label = context.target.label) {
  const result = buildIntegrationRequest(
    { ...context, target: { ...context.target, label } },
    { fields: ["body"] },
  );
  if (!result.ok) throw new Error("Expected request");
  return { request: result.request, output: buildRequestSnippets(result.request) };
}
describe("REST snippets from the validated model", () => {
  it("uses one URL and only the server-side credential placeholder", () => {
    const { request, output } = snippets();
    expect(output.url).toBe(request.url);
    expect(output.curl).toContain('--header "Authorization: Bearer ${XYNES_API_KEY}"');
    expect(output.curl).toContain("'\\''");
    expect(output.serverFetch).toContain(JSON.stringify(request.url));
    expect(output.serverFetch).toContain("Server-side REST");
    expect(output.serverFetch).toContain("process.env.XYNES_API_KEY");
    expect(output.serverFetch).toContain("response.ok");
    expect(output.serverFetch).toContain("result.ok !== true");
    expect(output.serverFetch).not.toContain("console.");
  });
  it("ignores quoted/newline/script-like labels and does not generate SDK/script tags", () => {
    const hostile = snippets("'\n${process.env.SECRET} $(touch marker) </script><script>alert(1)");
    expect(hostile.output).toEqual(snippets().output);
    expect(JSON.stringify(hostile.output)).not.toContain("SECRET");
    expect(JSON.stringify(hostile.output)).not.toContain("<script>");
    expect(JSON.stringify(hostile.output)).not.toContain("import ");
  });
});

// Execute copied artifacts only in owned local fixtures; no real curl/fetch runs.

it("copies executable cURL quoting and substitutes only the runtime key", () => {
  const { request, output } = snippets();
  const directory = mkdtempSync(join(tmpdir(), "cms-b1-curl-"));
  try {
    const executable = join(directory, "curl");
    const capture = join(directory, "args");
    writeFileSync(executable, `#!/bin/sh\nprintf '%s\\0' "$@" > "$CURL_ARGS_FILE"\n`);
    chmodSync(executable, 0o700);
    const runtimeKey = randomBytes(24).toString("hex");
    const result = spawnSync("/bin/sh", ["-c", output.curl], {
      env: {
        NODE_ENV: "test",
        PATH: directory,
        CURL_ARGS_FILE: capture,
        XYNES_API_KEY: runtimeKey,
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const args = readFileSync(capture, "utf8").split("\0");
    expect(args[args.indexOf("--url") + 1]).toBe(request.url);
    // Assert a boolean so failure output cannot disclose the fixture credential.
    expect(args[args.indexOf("--header") + 1] === `Authorization: Bearer ${runtimeKey}`).toBe(true);
    expect(args.filter((arg) => arg === "--url")).toHaveLength(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

type Scenario = { ok: boolean; status: number; payload: unknown; badJson?: boolean };
function executeFetch(scenario: Scenario, missingKey = false, directoryRequest = false) {
  let { request, output } = snippets();
  if (directoryRequest) {
    const result = buildIntegrationRequest({
      ...context,
      target: {
        kind: "directory",
        directoryId: context.target.entryId,
        label: "Folder",
        breadcrumb: "Contents",
      },
    });
    if (!result.ok) throw new Error("Expected directory request");
    request = result.request;
    output = buildRequestSnippets(request);
  }
  const directory = mkdtempSync(join(tmpdir(), "cms-b1-fetch-"));
  try {
    const file = join(directory, "copied.mjs");
    const prelude = `const spec = JSON.parse(process.env.SNIPPET_SCENARIO);
let usedRuntimeKey = false;
globalThis.fetch = async (url, options) => {
  if (url !== process.env.EXPECTED_URL || options.method !== "GET") throw new Error("Wrong copied request");
  usedRuntimeKey = options.headers.Authorization === "Bearer " + process.env.XYNES_API_KEY;
  return {ok: spec.ok, status: spec.status, json: async () => {
    if (spec.badJson) throw new Error("fixture private parse details");
    return spec.payload;
  }};
};\n`;
    writeFileSync(
      file,
      prelude + output.serverFetch + "\nconsole.log(JSON.stringify({usedRuntimeKey, data}));\n",
    );
    return spawnSync(process.execPath, [file], {
      env: {
        NODE_ENV: "test",
        XYNES_API_KEY: missingKey ? "" : randomBytes(24).toString("hex"),
        SNIPPET_SCENARIO: JSON.stringify(scenario),
        EXPECTED_URL: request.url,
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
it("runs the labelled server-side REST example with the actual model", () => {
  const data = { entry: { id: "33333333-3333-4333-8333-333333333333", body: null } };
  const result = executeFetch({ ok: true, status: 200, payload: { ok: true, data } });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ usedRuntimeKey: true, data });
});
it("fails safely for missing keys, HTTP errors and malformed delivery successes", () => {
  const scenarios = [
    { ok: false, status: 403, payload: { private: "must-not-echo" } },
    { ok: true, status: 200, payload: null },
    { ok: true, status: 200, payload: { ok: false, error: { private: "must-not-echo" } } },
    { ok: true, status: 200, payload: { ok: true, data: null } },
    { ok: true, status: 200, payload: { ok: true, data: [] } },
    { ok: true, status: 200, payload: { ok: true } },
    { ok: true, status: 200, payload: { ok: true, data: {} } },
    { ok: true, status: 200, payload: { ok: true, data: { entry: [] } } },
    { ok: true, status: 200, payload: {}, badJson: true },
  ];
  for (const scenario of scenarios) {
    const result = executeFetch(scenario);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain("must-not-echo");
    expect(result.stderr).not.toContain("fixture private parse details");
  }
  const missing = executeFetch({ ok: true, status: 200, payload: {} }, true);
  expect(missing.status).not.toBe(0);
  expect(missing.stderr).toContain("Missing XYNES_API_KEY");
});

it("checks the directory response envelope in copied fetch code", () => {
  const success = executeFetch(
    {
      ok: true,
      status: 200,
      payload: {
        ok: true,
        data: {
          items: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
          page: { limit: 20, offset: 0, hasMore: false },
        },
      },
    },
    false,
    true,
  );
  expect(success.status).toBe(0);
  for (const data of [
    {},
    { items: [{}], page: {} },
    { items: [], page: null },
    { items: [], page: { limit: "20", offset: 0, hasMore: false } },
  ]) {
    expect(
      executeFetch({ ok: true, status: 200, payload: { ok: true, data } }, false, true).status,
    ).not.toBe(0);
  }
});
