import fs from "node:fs";
import path from "node:path";
import sharp from "../client/node_modules/sharp/dist/index.mjs";

const ROOT = process.cwd();
const inputPath = "C:/Users/27389/.gemini/antigravity/brain/18fe0b51-ca4e-475a-8951-cd99a5715969/furina_chibi_avatar_1790243723631.jpg";

async function makeTransparent(inputBuffer) {
  const image = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Flood fill from all 4 borders to find outer white background
  const visited = new Uint8Array(width * height);
  const queue = [];

  function isWhite(x, y) {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Background is near-pure white (#fbfbfb to #ffffff)
    return r >= 246 && g >= 246 && b >= 246;
  }

  // Push all border pixels
  for (let x = 0; x < width; x++) {
    if (isWhite(x, 0)) {
      visited[x] = 1;
      queue.push(x, 0);
    }
    if (isWhite(x, height - 1)) {
      visited[(height - 1) * width + x] = 1;
      queue.push(x, height - 1);
    }
  }
  for (let y = 0; y < height; y++) {
    if (isWhite(0, y) && !visited[y * width]) {
      visited[y * width] = 1;
      queue.push(0, y);
    }
    if (isWhite(width - 1, y) && !visited[y * width + width - 1]) {
      visited[y * width + width - 1] = 1;
      queue.push(width - 1, y);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIndex = ny * width + nx;
        if (!visited[nIndex] && isWhite(nx, ny)) {
          visited[nIndex] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // Set alpha = 0 for outer white background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      if (visited[y * width + x]) {
        data[idx + 3] = 0; // Transparent
      } else {
        // Feather near border of visited
        let nearEdge = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (visited[ny * width + nx]) {
                nearEdge = true;
                break;
              }
            }
          }
          if (nearEdge) break;
        }
        if (nearEdge) {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          if (r > 240 && g > 240 && b > 240) {
            const brightness = (r + g + b) / 3;
            const alphaFactor = Math.max(0, Math.min(1, (255 - brightness) / 15));
            data[idx + 3] = Math.round(data[idx + 3] * alphaFactor);
          }
        }
      }
    }
  }

  return await sharp(data, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();
}

async function main() {
  console.log("Reading generated Furina image from:", inputPath);
  const inputBuffer = fs.readFileSync(inputPath);
  console.log("Removing background and making transparent...");
  const pngTransparent = await makeTransparent(inputBuffer);

  // 1. Output transparent PNG for docs
  const docsLogoPng = path.resolve(ROOT, "docs/docs/public/shirine-logo.png");
  const docsIconPng = path.resolve(ROOT, "docs/docs/public/shirine-icon.png");
  await sharp(pngTransparent).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(docsLogoPng);
  await sharp(pngTransparent).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(docsIconPng);
  console.log("Saved transparent docs images:", docsLogoPng, docsIconPng);

  // 2. Output WebP for demo-avatar and client icon
  const clientPublicAvatar = path.resolve(ROOT, "client/public/assets/images/demo-avatar.webp");
  const clientSrcAvatar = path.resolve(ROOT, "client/src/assets/images/demo-avatar.webp");
  const clientLogoIcon = path.resolve(ROOT, "client/public/logo/icon.webp");

  await sharp(pngTransparent).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 95, effort: 6 }).toFile(clientPublicAvatar);
  await sharp(pngTransparent).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 95, effort: 6 }).toFile(clientSrcAvatar);
  await sharp(pngTransparent).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 95, effort: 6 }).toFile(clientLogoIcon);

  console.log("Saved transparent WebP avatars:", clientPublicAvatar, clientSrcAvatar, clientLogoIcon);
}

main().catch(err => {
  console.error("Error processing Furina avatar:", err);
  process.exit(1);
});
