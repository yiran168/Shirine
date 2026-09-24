import fs from "node:fs";
import path from "node:path";

const srcFile = "C:/Users/27389/.gemini/antigravity/brain/18fe0b51-ca4e-475a-8951-cd99a5715969/.system_generated/steps/285/content.md";
const text = fs.readFileSync(srcFile, "utf8");
const splitIdx = text.indexOf("---");
const jsContent = text.slice(splitIdx + 3).trim();
const destCubism = path.resolve("client/public/pio/live2dcubismcore.min.js");
fs.writeFileSync(destCubism, jsContent, "utf8");
console.log("Wrote live2dcubismcore.min.js, bytes:", fs.statSync(destCubism).size);

const v2Src = "d:/MiMo Desktop/项目/1/live2d-widget-master/dist/live2d.min.js";
const destV2 = path.resolve("client/public/pio/live2d.min.js");
fs.copyFileSync(v2Src, destV2);
console.log("Wrote live2d.min.js, bytes:", fs.statSync(destV2).size);
