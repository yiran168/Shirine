import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "../client/node_modules/sharp/dist/index.mjs";

const ROOT = process.cwd();
const AVATAR_DIR = path.resolve(ROOT, "client/public/assets/avatars");

const sources = [
  // 1-5: Anime covers
  "client/public/assets/anime/cmmn.webp",
  "client/public/assets/anime/laxxx.webp",
  "client/public/assets/anime/lkls.webp",
  "client/public/assets/anime/rynh.webp",
  "client/public/assets/anime/tz1.webp",

  // 6-26: AcgExample album (excluding duplicate 14)
  "client/public/images/albums/AcgExample/01.webp",
  "client/public/images/albums/AcgExample/02.webp",
  "client/public/images/albums/AcgExample/03.webp",
  "client/public/images/albums/AcgExample/04.webp",
  "client/public/images/albums/AcgExample/05.webp",
  "client/public/images/albums/AcgExample/06.webp",
  "client/public/images/albums/AcgExample/07.webp",
  "client/public/images/albums/AcgExample/08.webp",
  "client/public/images/albums/AcgExample/09.webp",
  "client/public/images/albums/AcgExample/10.webp",
  "client/public/images/albums/AcgExample/11.webp",
  "client/public/images/albums/AcgExample/12.webp",
  "client/public/images/albums/AcgExample/13.webp",
  "client/public/images/albums/AcgExample/15.webp",
  "client/public/images/albums/AcgExample/16.webp",
  "client/public/images/albums/AcgExample/17.webp",
  "client/public/images/albums/AcgExample/18.webp",
  "client/public/images/albums/AcgExample/19.webp",
  "client/public/images/albums/AcgExample/20.webp",
  "client/public/images/albums/AcgExample/21.webp",
  "client/public/images/albums/AcgExample/22.webp",

  // 27: AcgExample cover
  "client/public/images/albums/AcgExample/cover.webp",

  // 28-31: Scenery series
  "client/public/images/moments/scenery/scene-1.webp",
  "client/public/images/moments/scenery/scene-2.webp",
  "client/public/images/moments/scenery/scene-3.webp",
  "client/public/images/moments/scenery/scene-4.webp",

  // 32-38: Moments girls roll
  "client/public/images/moments/girls-roll/roll-1.webp",
  "client/public/images/moments/girls-roll/roll-2.webp",
  "client/public/images/moments/girls-roll/roll-3.webp",
  "client/public/images/moments/girls-roll/roll-4.webp",
  "client/public/images/moments/girls-roll/roll-5.webp",
  "client/public/images/moments/girls-roll/roll-6.webp",
  "client/public/images/moments/girls-roll/roll-7.webp",

  // 39-41: Moments girls trio
  "client/public/images/moments/girls-trio/girl-1.webp",
  "client/public/images/moments/girls-trio/girl-2.webp",
  "client/public/images/moments/girls-trio/girl-3.webp",

  // 42: Sunlit window girl
  "client/public/images/moments/night/window-sun.webp",

  // 43-48: Demo portraits
  "client/src/content/posts/image-grid-demo/portrait-1.webp",
  "client/src/content/posts/image-grid-demo/portrait-2.webp",
  "client/src/content/posts/image-grid-demo/portrait-3.webp",
  "client/src/content/posts/image-grid-demo/portrait-4.webp",
  "client/src/content/posts/image-grid-demo/portrait-5.webp",
  "client/src/content/posts/image-grid-demo/portrait-6.webp",

  // 49: Mascot cloud girl
  "C:/Users/27389/.gemini/antigravity/brain/829b26c6-26d9-49b5-ba45-adeda458afdc/chibi_cloud_girl_1790173479093.jpg",

  // 50: Default portrait
  "client/src/content/posts/image-grid-demo/default-portrait-1.webp",
];

const AVATAR_METADATA = [
  { name: "千夏·元气咖啡", prompt: "Energetic anime barista girl with light brown ponytail, warm orange apron and friendly smile" },
  { name: "静流·青空私塾", prompt: "Gentle anime schoolgirl with dark navy bob cut, crisp sailor uniform under azure sky" },
  { name: "千束·赤心守护", prompt: "Spirited blonde twin-tail heroine with ruby red eyes and modern tactical academy uniform" },
  { name: "泷奈·夜幕沉着", prompt: "Cool black-haired anime girl with deep purple eyes, poised posture and quiet determination" },
  { name: "未来·歌姬幻想", prompt: "Futuristic idol girl with cyan dual pigtails, holographic hair ribbons and glowing audio visualizer" },
  { name: "银白长发·红瞳", prompt: "Silver-white flowing hair, crimson ruby eyes, gothic anime dress, ethereal atmosphere" },
  { name: "金发双马尾·活力", prompt: "Vibrant golden blonde twin-tails, emerald green eyes, cheerful smile in summer breeze" },
  { name: "黑发姬发式·和风", prompt: "Traditional black hime-cut tresses, amethyst violet eyes, delicate floral silk kimono" },
  { name: "樱粉短发·温柔", prompt: "Soft pastel pink layered bob, warm amber eyes, gentle smile under falling sakura blossoms" },
  { name: "冰蓝长发·清冷", prompt: "Frosty ice-blue cascading hair, deep sapphire eyes, tranquil snowy crystal hairpins" },
  { name: "栗色微卷·知性", prompt: "Chestnut wavy curls, hazel brown eyes, cozy knitted sweater, relaxed afternoon cafe vibe" },
  { name: "白发猫耳·软萌", prompt: "Snowy white pixie hair with fluffy feline ears, golden eyes, oversized hoodie" },
  { name: "紫罗兰·优雅", prompt: "Rich royal violet waves, golden diadem, elegant Victorian aristocratic anime maiden" },
  { name: "薄荷绿·森系", prompt: "Fresh mint green twin braids, leafy emerald eyes, woodland floral crown, ethereal sunlight" },
  { name: "墨黑马尾·飒爽", prompt: "Jet-black high ponytail, piercing steel-blue eyes, modern cyber jacket with neon accents" },
  { name: "珊瑚橙·元气", prompt: "Bright peach-coral wavy hair, playful wink, sunset beach vacation aesthetic" },
  { name: "薰衣草·梦幻", prompt: "Soft lavender purple locks, starry eyes, galaxy nebula reflections, celestial aesthetic" },
  { name: "浅金盘发·大小姐", prompt: "Champagne blonde braided updo, sapphire earrings, regal academy uniform portrait" },
  { name: "深海蓝·人鱼", prompt: "Deep ocean cyan gradient hair, luminous pearl hairpins, aquamarine bioluminescent glow" },
  { name: "赤焰红·热烈", prompt: "Crimson scarlet dynamic tresses, fierce fiery eyes, confident smirk with flame motif" },
  { name: "珍珠白·天使", prompt: "Feathered white locks, halo glimmer, gentle golden eyes, sacred serenity anime art" },
  { name: "青墨短发·剑客", prompt: "Sleek ink-black bob with asymmetric fringe, bamboo forest mist, wanderer samurai girl" },
  { name: "焦糖卷发·秋日", prompt: "Warm caramel autumn waves, maple leaf clip, wool scarf, golden hour illumination" },
  { name: "极光绿·电竞", prompt: "Neon lime-green accented dark hair, glowing cat-ear headset, vibrant cyberpunk streamer" },
  { name: "蜜桃粉·雀跃", prompt: "Fluffy peach-pink twintails, heart-shaped ribbon clips, sparkling bright anime eyes" },
  { name: "月光银·占星", prompt: "Moonlit silver straight hair, star constellation veil, mystical crescent tarot reader" },
  { name: "海蓝双丸子·俏皮", prompt: "Ocean blue twin space buns, playful expression, street fashion pastel jacket" },
  { name: "琥珀棕·学妹", prompt: "Warm amber-brown straight cut with neat fringe, classic notebook, quiet library corner" },
  { name: "烟灰微卷·朋克", prompt: "Smoky ash-gray layered shag with magenta tips, silver piercings, rock band guitarist" },
  { name: "白金长直·纯净", prompt: "Platinum blonde silk tresses, pale blue eyes, minimalist modern aesthetic portrait" },
  { name: "落樱红·巫女", prompt: "Traditional scarlet red ribbon tying back raven hair, white miko shrine attire, sacred bells" },
  { name: "青瓷色·恬静", prompt: "Celadon soft teal curls, ceramic flower barrette, quiet tea house afternoon setting" },
  { name: "金橙色·向日葵", prompt: "Sunny amber-gold side braid, sunflower accessory, cheerful outdoor countryside scene" },
  { name: "星空紫·魔女", prompt: "Midnight violet cascading locks, pointed arcane hat, glowing purple potion flask" },
  { name: "雪白短碎·精灵", prompt: "Tumbling snow-white short pixie cut, delicate pointed ears, dewdrop crystal pendant" },
  { name: "浅栗编发·文艺", prompt: "Soft chestnut crown braid, linen dress, sketchbook with watercolor palette" },
  { name: "绯红微卷·夜色", prompt: "Wine-red dramatic curls, dark gothic lace choker, vintage candlelight atmosphere" },
  { name: "青金渐变·机械", prompt: "Teal to gold gradient high twin-tails, mechanical hairpin, sci-fi engineer anime girl" },
  { name: "乳白长卷·甜点", prompt: "Cream-white whipped curls, strawberry cake motif, pastel pastry chef anime style" },
  { name: "深空蓝·星航", prompt: "Cosmic navy blue sleek cut, constellation star map visor, interstellar navigator" },
  { name: "暖杏色·冬日", prompt: "Apricot blonde shoulder-length bob, fluffy earmuffs, snow falling softly around" },
  { name: "石榴红·华丽", prompt: "Garnet red elaborate coiffure, velvet ribbon, baroque fantasy anime portrait" },
  { name: "琉璃青·灵动", prompt: "Lapis-tinted cyan dynamic waves, dragonfly hairpin, mountain stream breeze" },
  { name: "奶茶色·慵懒", prompt: "Milky tea brown wavy locks, sleepy cute expression, warm oversized fleece blanket" },
  { name: "黑曜石·干练", prompt: "Polished obsidian bob cut, sharp crimson glasses, stylish executive anime lady" },
  { name: "薄云粉·初晴", prompt: "Pale blush pink locks, morning dew sunshine, joyful smile after spring rain" },
  { name: "苍翠绿·射手", prompt: "Forest verdant braid, leather archer hood, focused gaze in sun-dappled glade" },
  { name: "香槟金·华尔兹", prompt: "Sparkling champagne blonde curls, crystal tiara, ballroom dance celebration" },
  { name: "暗夜黑·游侠", prompt: "Shadow black hooded fringe, midnight purple highlights, silver dagger silhouette" },
  { name: "晨曦金·晴空", prompt: "Radiant sunrise blonde twin tails, sky blue ribbons, soaring above fluffy morning clouds" },
];

async function encodeAvatarAbove10K(srcPath) {
  for (const q of [85, 92, 95, 98]) {
    const buf = await sharp(srcPath).resize(512, 512, { fit: "cover", position: "center" }).webp({ quality: q }).toBuffer();
    if (buf.length > 10240) return buf;
  }
  const bufLossless = await sharp(srcPath).resize(512, 512, { fit: "cover", position: "center" }).webp({ lossless: true }).toBuffer();
  if (bufLossless.length > 10240) return bufLossless;
  return await sharp(srcPath).resize(600, 600, { fit: "cover" }).webp({ quality: 95 }).toBuffer();
}

async function encodeThumbAbove10K(srcPath) {
  for (const size of [200, 240, 280, 320, 360]) {
    for (const q of [85, 95, 98]) {
      const buf = await sharp(srcPath).resize(size, size, { fit: "cover", position: "center" }).webp({ quality: q }).toBuffer();
      if (buf.length > 10240) return buf;
    }
    const bufLossless = await sharp(srcPath).resize(size, size, { fit: "cover", position: "center" }).webp({ lossless: true }).toBuffer();
    if (bufLossless.length > 10240) return bufLossless;
  }
  return await sharp(srcPath).resize(400, 400, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
}

async function main() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }

  const generatedHashes = new Set();
  const avatarJsonList = [];

  for (let i = 0; i < 50; i++) {
    const pad = String(i + 1).padStart(2, "0");
    const srcPath = path.resolve(ROOT, sources[i]);
    const avatarOut = path.resolve(AVATAR_DIR, `avatar_${pad}.webp`);
    const thumbOut = path.resolve(AVATAR_DIR, `avatar_${pad}_thumb.webp`);

    // 1. Process 512x512 full avatar
    const avatarBytes = await encodeAvatarAbove10K(srcPath);
    fs.writeFileSync(avatarOut, avatarBytes);

    // 2. Process thumbnail
    const thumbBytes = await encodeThumbAbove10K(srcPath);
    fs.writeFileSync(thumbOut, thumbBytes);

    if (avatarBytes.length <= 10240) {
      throw new Error(`Avatar ${pad} is too small: ${avatarBytes.length} bytes`);
    }
    if (thumbBytes.length <= 10240) {
      throw new Error(`Thumb ${pad} is too small: ${thumbBytes.length} bytes`);
    }

    const hash = crypto.createHash("sha256").update(avatarBytes).digest("hex");
    if (generatedHashes.has(hash)) {
      throw new Error(`Duplicate hash detected on avatar ${pad}: ${hash}`);
    }
    generatedHashes.add(hash);

    const meta = AVATAR_METADATA[i];
    avatarJsonList.push({
      id: i + 1,
      code: `avatar_${pad}`,
      name: meta.name,
      prompt: meta.prompt,
      url: `/assets/avatars/avatar_${pad}.webp`,
      thumbUrl: `/assets/avatars/avatar_${pad}_thumb.webp`,
    });

    console.log(`Generated avatar_${pad}.webp (${avatarBytes.length} B) and thumb (${thumbBytes.length} B)`);
  }

  // Write avatars.json
  const jsonPath = path.resolve(AVATAR_DIR, "avatars.json");
  fs.writeFileSync(jsonPath, JSON.stringify(avatarJsonList, null, 2), "utf-8");
  console.log(`Successfully generated avatars.json with ${avatarJsonList.length} items, all 50 hashes strictly unique!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
