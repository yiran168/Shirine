import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { musicRouter } from "../../server/src/routes/music";
import { createMusicRuntime, createMusicController } from "../../client/src/utils/music/music-runtime";

let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => { fetchSpy?.mockRestore(); fetchSpy = undefined; });

describe("Music provider responses", () => {
  for (const provider of ["netease", "tencent", "kugou"]) {
    it(`preserves ${provider} track authorization and resolves an actual audio URL`, async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("server")).toBe(provider);
        if (url.searchParams.get("type") === "playlist") return Response.json([{name:"Playable song", id:"42", url:`https://api.i-meto.com/meting/api?server=${provider}&type=url&id=42&auth=abc123`}]);
        expect(url.searchParams.get("auth")).toBe("abc123");
        return new Response(null, {status:302, headers:{Location:"https://audio.example.test/42.mp3"}});
      });
      const list = await (await musicRouter.request(`/playlist?server=${provider}&id=1`)).json() as any[];
      expect(list[0].url).toContain("auth=abc123");
      const response = await musicRouter.request(list[0].url.replace("/api/music", ""));
      expect(await response.json()).toEqual({success:true,url:"https://audio.example.test/42.mp3"});
    });
  }
  it("returns an explicit unavailable result for empty upstream audio, and rejects arbitrary providers", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({url:""}));
    expect((await musicRouter.request("/url?server=netease&id=42")).status).toBe(422);
    expect((await musicRouter.request("/url?server=http://127.0.0.1&id=42")).status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  it("falls back when a provider returns a playlist but its audio resolver is broken", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "api.i-meto.com") return new Response(null,{status:404});
      expect(url.searchParams.has("auth")).toBe(false);
      return new Response(null,{status:302,headers:{Location:"https://audio.example.test/working.mp3"}});
    });
    const response = await musicRouter.request("/url?server=netease&id=42&auth=abc123");
    expect(response.status).toBe(200);
    expect((await response.json() as any).url).toBe("https://audio.example.test/working.mp3");
  });
});

class FakeAudio extends EventTarget {
  src = ""; paused = true; currentTime = 0; duration = NaN; volume = 1; muted = false; preload = "";
  getAttribute(name: string) { return name === "src" ? this.src : null; }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  setAttribute() {}
  load() {}
  async play() { this.paused = false; this.dispatchEvent(new Event("play")); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
}
const tracks = [{id:"one",title:"One",source:"/api/music/url?server=netease&id=1"},{id:"two",title:"Two",source:"/assets/music/two.mp3"}];
function runtime(audio: FakeAudio, fetcher: typeof fetch) {
  return createMusicRuntime({provider:"custom",playlist:tracks,defaultVolume:0.7,defaultMode:"sequence"}, {createAudio:()=>audio as any,getStorage:()=>null,fetch:fetcher});
}
describe("Music playback recovery", () => {
  it("renews expired R2 audio before playing and does not retry an authorization failure", async () => {
    const audio = new FakeAudio();
    const expired = `/api/blob/music/one.mp3?expires=1&signature=${"a".repeat(64)}`;
    const renewed = expired.replace("expires=1&", `expires=${Math.floor(Date.now()/1000)+600}&`);
    let allowed = true, renewals = 0;
    const player = createMusicRuntime({provider:"custom",playlist:[{id:"one",title:"One",source:expired}],defaultVolume:.7,defaultMode:"sequence"}, {
      createAudio:()=>audio as any, getStorage:()=>null,
      fetch: (async (url: any, options: any) => {
        renewals++;
        expect(String(url)).toContain("/api/media/refresh?url=");
        expect(options.method).toBe("POST");
        expect(options.credentials).toBe("same-origin");
        return Response.json(allowed ? {success:true,url:renewed} : {success:false}, {status:allowed?200:403});
      }) as typeof fetch,
    });
    try {
      await player.play();
      expect(renewals).toBe(1);
      expect(audio.src).toBe(renewed);
      expect(player.getSnapshot().status).toBe("playing");
      audio.dispatchEvent(new Event("error"));
      allowed = false;
      await player.play();
      expect(renewals).toBe(2);
      expect(audio.src).toBe("");
      expect(player.getSnapshot().error).toBe("source-unavailable");
    } finally { player.destroy(); }
  });
  it("destroying an autoplay-blocked player removes its document interaction handlers", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");
    const doc = new EventTarget();
    const remove = spyOn(doc, "removeEventListener");
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    const audio = new FakeAudio();
    audio.play = async () => { throw new DOMException("Gesture required", "NotAllowedError"); };
    const player = runtime(audio, (async()=>Response.json({success:true,url:"https://audio.example.test/one.mp3"})) as typeof fetch);
    try {
      await player.play();
      expect(player.getSnapshot().error).toBe("autoplay-blocked");
      remove.mockClear();
      player.destroy();
      expect(remove.mock.calls.map(call=>call[0])).toEqual(["pointerdown","keydown","touchstart","click"]);
    } finally {
      player.destroy(); remove.mockRestore();
      if (original) Object.defineProperty(globalThis, "document", original); else Reflect.deleteProperty(globalThis,"document");
    }
  });
  it("both controls share playback when cover metadata or signed URLs differ, including after playlist replacement", async () => {
    const audios: FakeAudio[] = [];
    const shared = createMusicController({ createAudio: () => { const audio = new FakeAudio(); audios.push(audio); return audio as any; }, getStorage: () => null });
    const options = { provider: "custom" as const, defaultMode: "sequence" as const, defaultVolume: .7, playlist: [{id:"one", title:"One", source:"/api/blob/music/one.mp3?expires=100&signature=abc123", cover:"/cover.webp"}, {id:"two",title:"Two",source:"/assets/two.mp3"}] };
    const sidebar = shared.get(options);
    const seen: string[] = [];
    sidebar.subscribe(s => seen.push(`${s.currentTrack?.id}:${s.status}`));
    try {
      await sidebar.play();
      const floating = shared.get({ ...options, playlist: options.playlist.map(t => ({...t,source:t.source.replace("expires=100&signature=abc123", "expires=200&signature=def456"),cover:"/_astro/optimized.webp",coverSizes:"52px"})) });
      expect(floating).toBe(sidebar);
      expect(audios).toHaveLength(1);
      floating.pause();
      expect(sidebar.getSnapshot().status).not.toBe("playing");
      await floating.next();
      expect(sidebar.getSnapshot().currentTrack?.id).toBe("two");
      expect(seen).toContain("two:playing");
      const changed = shared.get({...options,playlist:[{id:"new",title:"New",source:"/assets/new.mp3"}]});
      expect(changed).toBe(sidebar);
      await changed.play();
      expect(seen).toContain("new:playing");
      expect(audios[0].paused).toBe(true);
      expect(audios.filter(a=>!a.paused)).toHaveLength(1);
    } finally { shared.destroy(); }
  });
  it("uses resolved audio, reads the real duration, and stops on failure without skipping through the playlist", async () => {
    const audio = new FakeAudio();
    const player = runtime(audio, (async()=>Response.json({success:true,url:"https://audio.example.test/one.mp3"})) as typeof fetch);
    try {
      await player.play();
      expect(audio.src).toBe("https://audio.example.test/one.mp3");
      audio.duration = 123;
      audio.dispatchEvent(new Event("loadedmetadata"));
      audio.dispatchEvent(new Event("canplay"));
      expect(player.getSnapshot().duration).toBe(123);
      audio.dispatchEvent(new Event("error"));
      expect(player.getSnapshot().status).toBe("error");
      expect(player.getSnapshot().currentIndex).toBe(0);
      expect(audio.src).toBe("");
      await player.next();
      expect(player.getSnapshot().currentIndex).toBe(1);
      expect(player.getSnapshot().status).toBe("playing");
    } finally { player.destroy(); }
  });
  it("an old pending resolver cannot replace a newly selected track", async () => {
    let resolve!: (response: Response) => void;
    const audio = new FakeAudio();
    const pending = new Promise<Response>(r => resolve = r);
    const player = runtime(audio, (()=>pending) as typeof fetch);
    try {
      const oldPlay = player.play();
      await new Promise(r=>setTimeout(r,0));
      await player.select(1);
      resolve(Response.json({success:true,url:"https://audio.example.test/old.mp3"}));
      await oldPlay;
      expect(audio.src).toBe(tracks[1].source);
      expect(player.getSnapshot().currentIndex).toBe(1);
    } finally { player.destroy(); }
  });
});
