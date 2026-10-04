import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { TestEnvironment } from "../helpers/test-env";
import { collectMediaPages, mergeMediaFiles, type MediaFile } from "../../client/src/utils/media-library";

let env: TestEnvironment;
beforeEach(() => { env = new TestEnvironment(); });
afterEach(() => env.close());
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wS8AAAAASUVORK5CYII=", "base64");
async function upload(name: string, cookie: string) {
  const body = new FormData();
  body.set("file", new File([png], name, { type: "image/png" }));
  return env.requestJson("/api/upload", { method: "POST", headers: { Cookie: cookie }, body });
}
const json = (body: unknown, cookie: string): RequestInit => ({ method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("post, moment, album and site uploads share the media library before and after publication", async () => {
  const admin = await env.createSuperadmin();
  const names = ["博文封面.png", "动态照片.png", "相册照片.png", "横幅.png", "站长头像.png", "音乐封面.png"];
  const files = [];
  for (const name of names) {
    const result = await upload(name, admin.cookie);
    expect(result.status).toBe(200);
    files.push(result.data);
  }
  const list = await env.requestJson("/api/upload", { headers: { Cookie: admin.cookie } });
  expect(list.data.objects.map((file: MediaFile) => file.originalName).sort()).toEqual([...names].sort());
  for (const file of files) {
    const listed = list.data.objects.find((item: MediaFile) => item.key === file.key);
    expect(listed.httpMetadata.contentType).toBe("image/png");
    expect(listed.uploaded).toBe(file.uploaded);
    expect(listed.url).toStartWith("/api/blob/");
    expect((await env.request(listed.url, { headers: { Cookie: admin.cookie } })).status).toBe(200);
    expect((await env.request(listed.url)).status).toBe(403);
  }
  expect((await env.requestJson("/api/posts", json({ title:"Uploaded post",slug:"uploaded-post",content:`![正文](${files[0].url})`,image:files[0].url },admin.cookie))).status).toBe(201);
  expect((await env.requestJson("/api/moments", json({ content:"Uploaded moment",images:[files[1].url] },admin.cookie))).data.success).toBe(true);
  expect((await env.requestJson("/api/albums", json({ title:"Uploaded album",photos:[files[2].url] },admin.cookie))).data.success).toBe(true);
  expect((await env.requestJson("/api/config/site", { ...json({ avatar:files[4].url,bannerDesktop:[files[3].url],musicTracks:[{title:"Test",source:"/assets/music/test.mp3",cover:files[5].url}] },admin.cookie),method:"PUT" })).data.success).toBe(true);
  for (const file of files) expect((await env.request(file.url)).status).toBe(200);
  expect((await env.requestJson("/api/upload", { headers: { Cookie: admin.cookie } })).data.objects).toHaveLength(names.length);
});

test("missing or failed R2 storage never reports a successful upload, list or delete", async () => {
  const admin = await env.createSuperadmin();
  env.env.STORAGE = undefined as any;
  for (const result of [
    await upload("未保存.png",admin.cookie),
    await env.requestJson("/api/upload",{headers:{Cookie:admin.cookie}}),
    await env.requestJson("/api/upload/uploads%2Fmissing.png",{method:"DELETE",headers:{Cookie:admin.cookie}}),
  ]) { expect(result.status).toBe(503); expect(result.data.success).toBe(false); expect(result.data.url).toBeUndefined(); }
  env.env.STORAGE = env.storage as any;
  env.storage.put = async () => { throw new Error("Simulated storage outage"); };
  expect((await upload("失败.png", admin.cookie)).data.success).toBe(false);
});

test("media catalog follows every page, preserves original names and puts the newest upload first", async () => {
  const admin = await env.createSuperadmin();
  setSystemTime(new Date("2020-01-01T00:00:00Z"));
  try {
    for (let i=0;i<205;i++) await env.storage.put(`archive/${String(i).padStart(3,"0")}.png`,png,{httpMetadata:{contentType:"image/png"},customMetadata:{originalName:`旧照片${i}.png`}});
  } finally { setSystemTime(); }
  const uploaded = (await upload("最新博文照片.png",admin.cookie)).data;
  const visited: (string|undefined)[] = [];
  let catalog: MediaFile[] = [];
  await collectMediaPages(async cursor => {
    visited.push(cursor);
    return (await env.requestJson(`/api/upload${cursor?`?cursor=${encodeURIComponent(cursor)}`:""}`,{headers:{Cookie:admin.cookie}})).data;
  }, files => { catalog = mergeMediaFiles(files,[]); },new AbortController().signal);
  expect(visited).toEqual([undefined,"100","200"]);
  expect(catalog).toHaveLength(206);
  expect(catalog[0].key).toBe(uploaded.key);
  expect(catalog.find(file=>file.originalName==="最新博文照片.png")?.key).toBe(uploaded.key);
});

test("deleting an uploaded object requires admin and removes it from the catalog", async () => {
  const admin = await env.createSuperadmin();
  const user = await env.createUser();
  const file = (await upload("删除测试.png",admin.cookie)).data;
  const path = `/api/upload/${encodeURIComponent(file.key)}`;
  expect((await env.requestJson(path,{method:"DELETE",headers:{Cookie:user.cookie}})).status).toBe(403);
  expect((await env.requestJson("/api/upload",{headers:{Cookie:user.cookie}})).status).toBe(403);
  expect((await env.requestJson(path,{method:"DELETE",headers:{Cookie:admin.cookie}})).data.success).toBe(true);
  expect((await env.requestJson("/api/upload",{headers:{Cookie:admin.cookie}})).data.objects).toHaveLength(0);
});

test("existing media keys containing spaces and URL punctuation remain previewable", async () => {
  const admin = await env.createSuperadmin();
  const key = "archive/旅行 #1?.png";
  await env.storage.put(key, png, { httpMetadata: { contentType: "image/png" } });
  const list = await env.requestJson("/api/upload", { headers: { Cookie: admin.cookie } });
  const file = list.data.objects[0];
  expect(file.originalName).toBe("旅行 #1?.png");
  expect(new URL(file.url, "https://shirine.example").pathname).toBe(`/api/blob/archive/${encodeURIComponent("旅行 #1?.png")}`);
  expect((await env.request(file.url, { headers: { Cookie: admin.cookie } })).status).toBe(200);
  expect((await env.request(file.url)).status).toBe(403);
});

test("cancelled catalog loads never publish stale data and repeated cursors stop", async () => {
  const controller = new AbortController();
  let release!: (value: any) => void;
  const published: MediaFile[][] = [];
  const work = collectMediaPages(() => new Promise(resolve => {release=resolve;}),files=>published.push(files),controller.signal);
  controller.abort();
  release({success:true,objects:[]});
  await work;
  expect(published).toEqual([]);
  let calls=0;
  await expect(collectMediaPages(async()=>{calls++;return {success:true,objects:[],cursor:"same"};},()=>{},new AbortController().signal)).rejects.toThrow("重复游标");
  expect(calls).toBe(2);
});
