import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
const root=path.resolve(import.meta.dirname,"..");
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const dir=path.join(root,"client/dist");
if(!fs.existsSync(dir))throw new Error("Build client/dist before checking Cloudflare limits");
const all=files(dir);
const workerDir=path.join(dir,"_worker.js");
const statics=all.filter(p=>p!==workerDir&&!p.startsWith(workerDir+path.sep));
let max=0,total=0,maxFile="";
for(const p of statics){const size=fs.statSync(p).size;total+=size;if(size>max){max=size;maxFile=path.relative(dir,p);}if(size>25*1024*1024)throw new Error(`Pages asset exceeds 25 MiB: ${p}`);}
if(statics.length>20000)throw new Error(`Pages has ${statics.length} files, exceeding the Free plan 20,000 limit`);
const workerFiles=fs.statSync(workerDir).isDirectory()?files(workerDir):[workerDir];
const gzip=workerFiles.filter(p=>!p.endsWith('.map')).reduce((n,p)=>n+gzipSync(fs.readFileSync(p)).length,0);
if(gzip>3*1024*1024)throw new Error(`Pages Worker compressed modules exceed the Free plan 3 MiB limit: ${gzip} bytes`);
console.log(JSON.stringify({staticFiles:statics.length,staticTotalMiB:+(total/1024/1024).toFixed(2),largestAsset:maxFile,largestAssetMiB:+(max/1024/1024).toFixed(2),workerGzipMiB:+(gzip/1024/1024).toFixed(2)},null,2));
