import { expect, test } from "bun:test";
import { createRequestCache } from "../../client/src/utils/request-cache";
import { withRequestLanguage } from "../../client/src/utils/request-language";
import { getCurrentLang, setSiteLang } from "../../client/src/i18n/translation";

test("SSR caching deduplicates within a request but never reuses another user's result", async () => {
  const cache = createRequestCache();
  const admin = new Request("https://blog.example/moments");
  const guest = new Request("https://blog.example/moments");
  let calls = 0;
  const read = () => cache.get(admin, "moments", async () => { calls++; return ["draft"]; });
  expect(await Promise.all([read(), read()])).toEqual([["draft"], ["draft"]]);
  expect(calls).toBe(1);
  expect(await cache.get(guest, "moments", async () => [])).toEqual([]);
  const fresh = new Request(admin);
  expect(await cache.get(fresh, "moments", async () => ["newly published"])).toEqual(["newly published"]);
});

test("concurrent SSR languages remain isolated across asynchronous rendering", async () => {
  const langs = ["ja", "en", "zh_TW", "zh_CN"];
  const results = await Promise.all(langs.map(lang => withRequestLanguage(lang, async () => {
    await new Promise(resolve => setTimeout(resolve, 2));
    setSiteLang("en"); // SSR components cannot mutate another request's language.
    return getCurrentLang();
  })));
  expect(results).toEqual(langs);
});
