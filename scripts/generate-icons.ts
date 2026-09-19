import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const allIcons = new Map<string, Set<string>>();

function addIcon(iconStr: string) {
	if (!iconStr || typeof iconStr !== "string") return;
	const cleaned = iconStr.trim();
	const match = cleaned.match(/^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/);
	if (!match) return;
	const [, set, name] = match;
	const validSets = [
		"material-symbols",
		"fa6-brands",
		"fa6-regular",
		"fa6-solid",
		"simple-icons",
	];
	if (!validSets.includes(set)) return;
	if (!allIcons.has(set)) allIcons.set(set, new Set());
	allIcons.get(set)!.add(name);
}

function scanFile(filePath: string) {
	const content = fs.readFileSync(filePath, "utf8");
	const regex =
		/["']((?:material-symbols|fa6-brands|fa6-regular|fa6-solid|simple-icons):[a-zA-Z0-9_-]+)["']/g;
	for (const m of content.matchAll(regex)) {
		addIcon(m[1]);
	}
}

function walk(dir: string) {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (
				!["node_modules", ".astro", "dist", ".git", ".wrangler"].includes(
					entry.name,
				)
			) {
				walk(full);
			}
		} else if (
			/\.(astro|svelte|ts|js|mjs|json|md|mdx|yaml|yml|sql)$/.test(entry.name)
		) {
			scanFile(full);
		}
	}
}

walk(path.join(projectRoot, "client/src"));
walk(path.join(projectRoot, "client/public"));
walk(path.join(projectRoot, "server/src"));

// Ensure all icons used in file-tree-icons.mjs & audio-reader are present
const fileTreeMaterial = [
	"account-tree-outline-rounded",
	"code-rounded",
	"chevron-right-rounded",
	"folder-rounded",
	"draft-outline-rounded",
	"data-object-rounded",
	"markdown-outline-rounded",
	"fullscreen-rounded",
	"fullscreen-exit-rounded",
	"volume-up-rounded",
];
for (const name of fileTreeMaterial) {
	addIcon(`material-symbols:${name}`);
}

const fileTreeSimple = [
	"npm",
	"git",
	"docker",
	"typescript",
	"javascript",
	"svelte",
	"astro",
	"vuedotjs",
	"css",
	"stylus",
	"html5",
	"python",
	"go",
	"rust",
	"gnubash",
	"yaml",
	"svg",
];
for (const name of fileTreeSimple) {
	addIcon(`simple-icons:${name}`);
}

// Popular social media & brand icons for user/admin links configuration
const commonSocialBrands = [
	"twitter",
	"x-twitter",
	"github",
	"steam",
	"bilibili",
	"discord",
	"telegram",
	"youtube",
	"facebook",
	"instagram",
	"linkedin",
	"reddit",
	"mastodon",
	"weibo",
	"zhihu",
	"qq",
	"weixin",
	"tiktok",
	"twitch",
	"patreon",
	"medium",
	"spotify",
	"apple",
	"google",
	"gitlab",
	"cloudflare",
	"creative-commons",
];
for (const name of commonSocialBrands) {
	addIcon(`fa6-brands:${name}`);
}

// Common solid UI icons for dynamic usage
const commonSolid = [
	"arrow-rotate-left",
	"chevron-right",
	"chevron-left",
	"chevron-up",
	"chevron-down",
	"magnifying-glass",
	"house",
	"user",
	"gear",
	"envelope",
	"link",
	"share",
	"heart",
	"star",
	"circle-info",
	"triangle-exclamation",
	"circle-check",
	"circle-xmark",
	"bars",
	"tag",
	"tags",
	"folder",
	"calendar",
	"clock",
	"eye",
	"lock",
	"unlock",
	"arrow-right",
	"arrow-left",
	"check",
	"xmark",
];
for (const name of commonSolid) {
	addIcon(`fa6-solid:${name}`);
}

// Additional simple-icons for programming languages / platforms
const commonSimple = [
	"c",
	"cplusplus",
	"csharp",
	"java",
	"kotlin",
	"swift",
	"php",
	"ruby",
	"rust",
	"go",
	"python",
	"javascript",
	"typescript",
	"astro",
	"svelte",
	"react",
	"vuedotjs",
	"tailwindcss",
	"sass",
	"nodedotjs",
	"openjdk",
	"playwright",
	"postgresql",
	"mysql",
	"sqlite",
	"redis",
	"mongodb",
	"linux",
	"apple",
	"windows11",
	"visualstudiocode",
];
for (const name of commonSimple) {
	addIcon(`simple-icons:${name}`);
}

function getIconsSubset(data: any, names: string[]) {
	const icons: Record<string, any> = {};
	const aliases: Record<string, any> = {};
	for (const name of names) {
		if (data.icons && data.icons[name]) {
			icons[name] = data.icons[name];
		} else if (data.aliases && data.aliases[name]) {
			aliases[name] = data.aliases[name];
			let parent = aliases[name].parent;
			while (parent) {
				if (data.icons && data.icons[parent]) {
					icons[parent] = data.icons[parent];
					break;
				}
				if (data.aliases && data.aliases[parent]) {
					aliases[parent] = data.aliases[parent];
					parent = data.aliases[parent].parent;
				} else {
					break;
				}
			}
		}
	}
	return {
		prefix: data.prefix,
		icons,
		aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
		width: data.width,
		height: data.height,
	};
}

const manifest: Record<string, string[]> = {};
for (const [set, names] of allIcons.entries()) {
	manifest[set] = [...names].sort();
}

// Save icon-manifest.json
fs.writeFileSync(
	path.join(projectRoot, "client/src/generated/icon-manifest.json"),
	JSON.stringify(manifest, null, 2),
	"utf8",
);
console.log("Saved client/src/generated/icon-manifest.json");

const sets = [
	"material-symbols",
	"fa6-brands",
	"fa6-regular",
	"fa6-solid",
	"simple-icons",
];
const varNames: Record<string, string> = {
	"material-symbols": "materialSymbols",
	"fa6-brands": "fa6Brands",
	"fa6-regular": "fa6Regular",
	"fa6-solid": "fa6Solid",
	"simple-icons": "simpleIcons",
};

const collectionsObj: Record<string, any> = {};

for (const set of sets) {
	const fullPkg = JSON.parse(
		fs.readFileSync(
			path.join(
				projectRoot,
				`client/node_modules/@iconify-json/${set}/icons.json`,
			),
			"utf8",
		),
	);
	const names = manifest[set] || [];
	const subset = getIconsSubset(fullPkg, names);
	const varName = varNames[set];
	collectionsObj[varName] = subset;
}

// Save local-icon-collections.json
fs.writeFileSync(
	path.join(projectRoot, "client/src/generated/local-icon-collections.json"),
	JSON.stringify(collectionsObj),
	"utf8",
);
console.log("Saved client/src/generated/local-icon-collections.json");

// Generate local-icon-collections.ts
const tsContent = `// Auto-generated by scripts/generate-icons.ts - DO NOT EDIT MANUALLY
import iconCollections from "./local-icon-collections.json" with { type: "json" };

export const materialSymbols = iconCollections.materialSymbols;
export const fa6Brands = iconCollections.fa6Brands;
export const fa6Regular = iconCollections.fa6Regular;
export const fa6Solid = iconCollections.fa6Solid;
export const simpleIcons = iconCollections.simpleIcons;

export const localIconCollections = [
	materialSymbols,
	fa6Brands,
	fa6Regular,
	fa6Solid,
	simpleIcons,
];

export default localIconCollections;
`;

fs.writeFileSync(
	path.join(projectRoot, "client/src/generated/local-icon-collections.ts"),
	tsContent,
	"utf8",
);
console.log("Saved client/src/generated/local-icon-collections.ts");
