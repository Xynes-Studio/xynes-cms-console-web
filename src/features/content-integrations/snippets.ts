import { getResponseFields } from "./delivery-contract";
import type { IntegrationRequest, RequestSnippets, ResponseField } from "./types";
function shellQuote(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
function invalidField(target: string, field: ResponseField) {
  const value = `${target}[${JSON.stringify(field.name)}]`;
  if (field.type === "string") return `typeof ${value} !== "string"`;
  if (field.type === "string[]")
    return `!Array.isArray(${value}) || ${value}.some(tag => typeof tag !== "string")`;
  return `(${value} !== null && (typeof ${value} !== "object" || Array.isArray(${value})))`;
}
/** Formats only the model produced by buildIntegrationRequest. No code executes here. */
export function buildRequestSnippets(request: IntegrationRequest): RequestSnippets {
  const curl = [
    "curl --fail --silent --show-error --request GET",
    `  --url ${shellQuote(request.url)}`,
    `  --header "Authorization: ${request.headers.Authorization}"`,
  ].join(" \\\n");
  const target = request.kind === "entry" ? "result.data.entry" : "item";
  const invalidProjection = getResponseFields(request)
    .map((field) => invalidField(target, field))
    .join(" || ");
  const invalidRecord = `${target} === null || typeof ${target} !== "object" || Array.isArray(${target}) || ${invalidProjection}`;
  const invalidData =
    request.kind === "entry"
      ? invalidRecord
      : `!Array.isArray(result.data.items) || result.data.items.some(item => ${invalidRecord}) || result.data.page === null || typeof result.data.page !== "object" || !Number.isInteger(result.data.page.limit) || !Number.isInteger(result.data.page.offset) || typeof result.data.page.hasMore !== "boolean"`;
  const serverFetch = [
    "// Server-side REST fetch (Node.js). Keep XYNES_API_KEY out of browser code.",
    "const apiKey = process.env.XYNES_API_KEY;",
    'if (!apiKey?.trim()) throw new Error("Missing XYNES_API_KEY");',
    `const response = await fetch(${JSON.stringify(request.url)}, {`,
    '  method: "GET",',
    "  headers: { Authorization: `Bearer ${apiKey}` },",
    "});",
    "if (!response.ok) throw new Error(`CMS delivery request failed (${response.status})`);",
    "let result;",
    'try { result = await response.json(); } catch { throw new Error("Invalid CMS delivery JSON"); }',
    'if (result === null || typeof result !== "object" || Array.isArray(result) || result.ok !== true || result.data === null || typeof result.data !== "object" || Array.isArray(result.data)) {',
    '  throw new Error("Invalid CMS delivery response");',
    "}",
    `if (${invalidData}) throw new Error("Invalid CMS delivery data");`,
    "const data = result.data;",
  ].join("\n");
  return { url: request.url, curl, serverFetch };
}
