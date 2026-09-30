import path from "node:path";
import sharp from "../client/node_modules/sharp/dist/index.mjs";

// The user-provided original is kept in the project. Preserve its artwork and alpha.
const root = path.resolve(import.meta.dirname, "..");
const original = path.join(root, "client/public/assets/images/shirine-owner-original.png");
for (const file of [
  "client/public/assets/images/demo-avatar.webp",
  "client/src/assets/images/demo-avatar.webp",
  "client/public/logo/icon.webp",
]) {
  await sharp(original).resize(512, 512).webp({ quality: 95, effort: 6 }).toFile(path.join(root, file));
}
for (const [file, size] of [
  ["docs/docs/public/shirine-logo.png", 512],
  ["docs/docs/public/shirine-icon.png", 128],
]) {
  await sharp(original).resize(size, size).png().toFile(path.join(root, file));
}
console.log("Updated the site owner, repository introduction and documentation portraits.");
