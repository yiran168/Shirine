import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { musicRouter } from "../../server/src/routes/music";
import { createMusicRuntime } from "../../client/src/utils/music/music-runtime";

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
