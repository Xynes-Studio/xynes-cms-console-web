/** Lexical public-gateway policy only; pure helpers never perform DNS or fetch. */
export function parseGatewayBase(value: string): URL | null {
  if (
    value !== value.trim() ||
    /[\u0000-\u0020\u007f]/.test(value) ||
    value.includes("?") ||
    value.includes("#")
  )
    return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) return null;
    const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/]+)/i)?.[1];
    if (!authority || authority.includes("@")) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
    if (url.protocol === "http:") {
      return loopback && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(authority)
        ? url
        : null;
    }
    if (loopback) return url;
    if (host.startsWith("[")) {
      const address = host.slice(1, -1);
      // Conservative literal policy: global-unicast 2000::/3; ::1 was handled above.
      // DNS hosts remain configurable and are not resolved by this pure module.
      const firstWord = Number.parseInt(address.split(":")[0], 16);
      return firstWord >= 0x2000 && firstWord < 0x4000 ? url : null;
    }
    const octets = host.split(".").map(Number);
    if (
      octets.length === 4 &&
      octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ) {
      const [first, second] = octets;
      const privateAddress =
        first === 0 ||
        first === 10 ||
        first === 127 ||
        first >= 224 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 100 && second >= 64 && second <= 127);
      return privateAddress ? null : url;
    }
    if (
      !host.includes(".") ||
      [".internal", ".local", ".localhost", ".home.arpa", ".test", ".invalid"].some((suffix) =>
        host.endsWith(suffix),
      )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
