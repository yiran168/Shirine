import { Hono } from "hono";
import type { Env, Variables } from "../types";

const providers = new Set(["netease", "tencent", "kugou"]);
const endpoints = ["https://api.i-meto.com/meting/api", "https://api.injahow.cn/meting/"];
export const musicRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function params(server: string | undefined, id: string | undefined) {
  const provider = server === "qq" ? "tencent" : server || "netease";
  return providers.has(provider) && id && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? { provider, id } : null;
}

musicRouter.get("/playlist", async c => {
  const input = params(c.req.query("server"), c.req.query("id"));
  if (!input) return c.json({ success: false, error: "Invalid music provider or playlist" }, 400);
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}?server=${input.provider}&type=playlist&id=${input.id}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const songs: any = await response.json();
      if (!Array.isArray(songs) || !songs.length) continue;
      const data = songs.slice(0, 500).flatMap(song => {
        const raw = String(song.url || "");
        let id = String(song.id || ""), source = raw;
        try {
          const upstream = new URL(raw);
          if (upstream.protocol !== "https:" && upstream.protocol !== "http:") return [];
          id ||= upstream.searchParams.get("id") || "";
          if (endpoints.some(api => upstream.origin === new URL(api).origin)) {
            const query = new URLSearchParams({ server: input.provider, id, endpoint: String(endpoints.findIndex(api => new URL(api).origin === upstream.origin)) });
            const auth = upstream.searchParams.get("auth");
            if (auth && /^[a-zA-Z0-9]{1,128}$/.test(auth)) query.set("auth", auth);
            source = `/api/music/url?${query}`;
          }
        } catch { return []; }
        return [{ ...song, id, url: source }];
      });
      if (data.length) return c.json(data);
    } catch {}
  }
  return c.json({ success: false, error: "音乐平台暂时无法提供歌单，请稍后重试或配置自己的音频文件。" }, 502);
});

// Resolve metadata/redirect responses to an actual audio URL. Never proxy a
// caller-supplied host or relay audio bytes through the site's R2 bucket.
musicRouter.get("/url", async c => {
  const input = params(c.req.query("server"), c.req.query("id"));
  if (!input) return c.json({ success: false, error: "Invalid music track" }, 400);
  const index = c.req.query("endpoint") === "1" ? 1 : 0;
  const auth = c.req.query("auth");
  for (const endpointIndex of [index, 1 - index]) {
   try {
    const query = new URLSearchParams({ server: input.provider, type: "url", id: input.id });
    // Authorization belongs to the endpoint that issued the playlist.
    if (endpointIndex === index && auth && /^[a-zA-Z0-9]{1,128}$/.test(auth)) query.set("auth", auth);
    const resolver = `${endpoints[endpointIndex]}?${query}`;
    const response = await fetch(resolver, { redirect: "manual", signal: AbortSignal.timeout(endpointIndex === index ? 4000 : 7000) });
    let source = response.headers.get("location") || "";
    if (!source && response.ok && response.headers.get("content-type")?.includes("json")) {
      const data: any = await response.json();
      source = data.url || data.data?.url || data.data?.[0]?.url || data[0]?.url || "";
    }
    if (!source) throw new Error("Unavailable source");
    const url = new URL(source, resolver);
    if (!["https:", "http:"].includes(url.protocol) || endpoints.some(api => new URL(api).hostname === url.hostname)) throw new Error("Unavailable source");
    url.protocol = "https:";
    return c.json({ success: true, url: url.href });
   } catch {}
  }
  return c.json({ success: false, error: "这首歌曲没有可播放的公开音源（可能受版权、会员或地区限制）。请选择其他曲目。" }, 422);
});
