import { expect, test } from "bun:test";
import { createRequire } from "node:module";

const clientRequire = createRequire(new URL("../../client/package.json", import.meta.url));
const astroRequire = createRequire(clientRequire.resolve("astro/package.json"));
const CachePolicy = astroRequire("http-cache-semantics");
const { stringify, parse, uneval } = astroRequire("devalue");

test("serialized Node buffers never expose unrelated backing memory", () => {
  const backing = new Uint8Array(64).fill(99);
  backing.set([1, 2], 8);
  const view = Buffer.from(backing.buffer, 8, 2);
  const restored = parse(stringify(view));
  expect(Array.from(restored)).toEqual([1, 2]);
  expect(restored.buffer.byteLength).toBe(2);
  expect(uneval(view)).toBe("new Uint8Array([1,2])");
});

test("shared HTTP caches cannot reuse sensitive responses through max-stale", () => {
  const request = { url: "https://example.test/account", method: "GET", headers: { host: "example.test" } };
  for (const headers of [
    { "set-cookie": "test_session=private", "cache-control": "max-age=60" },
    { "cache-control": "proxy-revalidate, max-age=60" },
    { "cache-control": "no-cache, stale-while-revalidate=999999" },
    { "cache-control": "private, max-age=60" },
    { "cache-control": "no-store" },
  ]) {
    const policy = new CachePolicy(request, { status: 200, headers });
    for (const directive of ["max-stale", "max-stale=999999"]) {
      const next = { ...request, headers: { ...request.headers, "cache-control": directive } };
      expect(policy.satisfiesWithoutRevalidation(next)).toBe(false);
      expect(policy.evaluateRequest(next).response).toBeUndefined();
    }
  }
});

test("ordinary public cached assets retain permitted stale reuse", () => {
  const request = { url: "https://example.test/image.webp", method: "GET", headers: { host: "example.test" } };
  const policy = new CachePolicy(request, { status: 200, headers: { "cache-control": "public, max-age=0" } });
  expect(policy.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale=60" } })).toBe(true);
});
