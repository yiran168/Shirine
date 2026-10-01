import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const names = ["live2dcubismcore.min.js", "live2d.min.js"];
// Optional inputs must be licensed SDK files already staged inside this project.
// With no arguments this checks the bundled files without overwriting them.
for (let i = 0; i < names.length; i++) {
  const destination = path.join(root, "client/public/pio", names[i]);
  const source = fs.realpathSync(path.resolve(root, process.argv[i + 2] || destination));
  const relative = path.relative(fs.realpathSync(root), source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("SDK inputs must stay inside the current project");
  const content = fs.readFileSync(source, "utf8");
  if (content.length < 1024 || /^\s*</.test(content)) throw new Error(`Invalid SDK JavaScript: ${names[i]}`);
  if (source !== fs.realpathSync(destination)) fs.copyFileSync(source, destination);
  console.log(`${names[i]}: ${fs.statSync(destination).size} bytes verified`);
}
