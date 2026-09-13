import fs from "node:fs";
import path from "node:path";

const srcDocsDir = "d:\\MiMo Desktop\\项目\\1\\Rin-main\\docs\\docs";
const destDocsDir = "d:\\MiMo Desktop\\项目\\1\\Shirine\\docs\\docs";

// 1. Clean destDocsDir and re-copy from Rin-main
if (fs.existsSync(destDocsDir)) {
  fs.rmSync(destDocsDir, { recursive: true, force: true });
}
fs.cpSync(srcDocsDir, destDocsDir, { recursive: true });

// 2. Copy Shirine logo and icon
const logoSrc = "d:\\MiMo Desktop\\项目\\1\\Shirine\\client\\public\\logo\\icon.webp";
fs.copyFileSync(logoSrc, path.join(destDocsDir, "public", "shirine-icon.png"));
fs.copyFileSync(logoSrc, path.join(destDocsDir, "public", "shirine-logo.png"));

// 3. Recursive walker
function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, callback);
    } else if (/\.(md|mdx|json)$/i.test(f)) {
      callback(full);
    }
  }
}

walk(destDocsDir, (filePath) => {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content
    .replace(/openRin\/Rin/g, "yiran168/Shirine")
    .replace(/https:\/\/docs\.openrin\.org/g, "https://yiran168.github.io/Shirine")
    .replace(/https:\/\/github\.com\/openRin\/Rin/g, "https://github.com/yiran168/Shirine")
    .replace(/rin-logo\.png/g, "shirine-logo.png")
    .replace(/rin-icon\.png/g, "shirine-icon.png")
    .replace(/\bRin\b/g, "Shirine")
    .replace(/\brin-client\b/g, "shirine-client")
    .replace(/\brin-server\b/g, "shirine-server")
    .replace(/\brin-db\b/g, "shirine-db");
  fs.writeFileSync(filePath, content, "utf-8");
});

console.log("Successfully processed all docs with clean UTF-8 encoding!");
