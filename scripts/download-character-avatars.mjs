import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "../client/node_modules/sharp/dist/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "client/public/assets/avatars");
const stage = path.join(root, ".cache/anime-avatars");
const roster = [];
function add(series, sourcePage, entries, imageUrl) {
  for (const [code, name, number] of entries) roster.push({code, name, series, sourcePage, source: imageUrl(number ?? code)});
}
add("葬送的芙莉莲", "https://frieren-anime.jp/special/icon/", [
  ["frieren","芙莉莲",1],["fern","菲伦",2],["stark","修塔尔克",3],["himmel","欣梅尔",4],
  ["flamme","伏拉梅",7],
  ["lawine","拉比涅",23],["kanne","康涅",24],
  ["laufen","菈欧芬",27],["ubel","尤贝尔",28],
  ["serie","赛丽艾",39],
], n=>`https://frieren-anime.jp/wp-content/themes/frieren_2023/assets/img/special/icon/${String(n).padStart(3,"0")}.jpg`);
add("孤独摇滚！", "https://bocchi.rocks/special/icon_present/", [
  ["hitori-gotoh","后藤一里",1],["nijika-ijichi","伊地知虹夏",2],["ryo-yamada","山田凉",3],["ikuyo-kita","喜多郁代",4],
], n=>`https://bocchi.rocks/_teaser/assets/img/special/icon_present/files/dc_icon_${n}.png`);
add("莉可丽丝", "https://lycoris-recoil.com/special/tw250000/", [
  ["chisato","锦木千束"],["takina","井之上泷奈"],["mizuki","中原瑞希"],["kurumi","胡桃"],
], code=>`https://lycoris-recoil.com/assets/img/special/tw250000/25_icon_${code}.png`);
add("我推的孩子", "https://ichigoproduction.com/Season1/special/present_icon.html", [
  ["ai-hoshino","星野爱",1],["aqua-hoshino","星野阿库亚",11],["ruby-hoshino","星野露比",21],
  ["kana-arima","有马加奈",32],["mem-cho","MEM啾",43],["miyako-saitou","齐藤京子",46],
], n=>`https://ichigoproduction.com/Season1/core_sys/images/contents/00000048/block/00000173/${String(206+n).padStart(8,"0")}.jpg`);
add("五等分的新娘", "https://www.tbs.co.jp/anime/5hanayome/1st/special/special11.html", [
  ["ichika-nakano","中野一花",1],["nino-nakano","中野二乃",2],["miku-nakano","中野三玖",3],["yotsuba-nakano","中野四叶",4],["itsuki-nakano","中野五月",5],
], n=>`https://www.tbs.co.jp/anime/5hanayome/1st/special/img/special11/icon_0${n}.png`);
add("摇曳百合", "https://yuruyuri.com/3hai/special/icon.php", [
  ["akari","赤座灯里","20160101/icon_yryr160101_akari"],["chinatsu","吉川千夏","20160101/icon_yryr160101_chinatsu"],
  ["kyoko","岁纳京子","20160101/icon_yryr160101_kyoko"],["yui","船见结衣","20160101/icon_yryr160101_yui"],
  ["ayano","杉浦绫乃","20151231/icon_yryr151231_ayano"],["chitose","池田千岁","20151231/icon_yryr151231_chitose"],
  ["sakurako","大室樱子","20151231/icon_yryr151231_sakurako"],["himawari","古谷向日葵","20151231/icon_yryr151231_himawari"],
  ["rise","松本理世","20151229/icon_yryr151229_rise"],["hanako","大室花子","20151228/icon_yryr151228_hanako"],
], file=>`https://yuruyuri.com/3hai/special/img_icon/${file}_${file.endsWith("chinatsu") ? "07" : file.endsWith("kyoko") ? "06" : "01"}.jpg`);
add("请问您今天要来点兔子吗？", "https://www.gochiusa.com/news/hp0001/index00040000.html", [
  ["cocoa","保登心爱"],["chino","香风智乃"],["rize","天々座理世"],["syaro","桐间纱路"],["chiya","宇治松千夜"],
], code=>`https://www.gochiusa.com/core_sys/images/main/cont/news/t_icon/${code}.jpg`);
add("青春猪头少年不会梦到兔女郎学姐", "https://rascaldoesnotdream.com/tv/special/icon-wp02/", [
  ["mai","樱岛麻衣"],["tomoe","古贺朋绘"],["rio","双叶理央"],["nodoka","丰滨和香"],["kaede","梓川枫"],["shoko","牧之原翔子"],
], code=>`https://rascaldoesnotdream.com/tv/assets/img/special/in/degicon02/icon2_${code}.png`);
if (roster.length !== 50) throw new Error("Expected exactly 50 anime characters");
await fs.mkdir(stage, {recursive:true});
async function download(url) {
  for (let attempt=0; attempt<3; attempt++) {
    try { const r=await fetch(url,{signal:AbortSignal.timeout(20000)}); if(!r.ok)throw new Error(`${r.status} ${url}`);return Buffer.from(await r.arrayBuffer()); }
    catch(e){if(attempt===2)throw e;}
  }
}
const manifest = [];
const hashes = new Set();
for (let i=0;i<roster.length;i++) {
  const item=roster[i];let raw;
  const cacheFile = path.join(stage, item.code + "-" + crypto.createHash("sha256").update(item.source).digest("hex").slice(0,12) + ".source");
  try { raw=await fs.readFile(cacheFile); } catch { raw=await download(item.source); await fs.writeFile(cacheFile,raw); }
  const sourceSha256=crypto.createHash("sha256").update(raw).digest("hex");
  if(hashes.has(sourceSha256))throw new Error(`Duplicate character image: ${item.name}`);hashes.add(sourceSha256);
  for(const [size,suffix,quality] of [[384,"",88],[96,"-thumb",82]]) await sharp(raw).resize(size,size,{fit:"contain",background:"#eef0f8"}).webp({quality}).toFile(path.join(stage,item.code+suffix+".webp"));
  manifest.push({id:i+1,...item,url:`/assets/avatars/${item.code}.webp`,thumbUrl:`/assets/avatars/${item.code}-thumb.webp`,sourceSha256,rights:"Officially distributed personal-use SNS icon. Character artwork belongs to its credited creators and production committee; excluded from the repository MIT license."});
  console.log(`${i+1}/50 ${item.series} · ${item.name}`);
}
// Commit the resource set only once all 50 originals have downloaded and decoded.
await fs.mkdir(dir,{recursive:true});
for(const name of await fs.readdir(dir)) if(name.endsWith(".webp")) await fs.unlink(path.join(dir,name));
for(const item of manifest)for(const suffix of [".webp","-thumb.webp"]) await fs.copyFile(path.join(stage,item.code+suffix),path.join(dir,item.code+suffix));
await fs.writeFile(path.join(dir,"avatars.json"),JSON.stringify(manifest,null,2)+"\n");
await fs.mkdir(path.join(root,"client/public/avatars"),{recursive:true});
await fs.writeFile(path.join(root,"client/public/avatars/avatars.json"),JSON.stringify(manifest,null,2)+"\n");
await fs.writeFile(path.join(root,"server/src/core/avatar-presets.ts"),`// Generated by scripts/download-character-avatars.mjs.\nconst codes = ${JSON.stringify(manifest.map(x=>x.code))};\nexport function normalizeLegacyAvatar(value: string): string {\n  const match = value.match(/^\\/(?:assets\\/)?avatars\\/avatar_(\\d+)(?:_thumb)?\\.webp$/);\n  return match ? '/assets/avatars/' + (codes[Number(match[1])-1] || 'frieren') + '.webp' : value;\n}\n`);
await fs.appendFile(path.join(root,"server/src/core/avatar-presets.ts"), '\nexport function isPresetAvatar(value: string): boolean { return codes.some(code => value === "/assets/avatars/" + code + ".webp"); }\n');
console.log("50 verified anime character avatars ready. The separate Furina site-owner portrait is unchanged.");
