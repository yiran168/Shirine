import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import svelte from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { expressiveCodeConfig } from "./src/config/expressiveCodeConfig.ts";
import { resolvedFontOptions } from "./src/config/fontConfig.ts";
import { musicConfig, resolveMusicOptions } from "./src/config/musicConfig.ts";
import { sidebarConfig } from "./src/config/sidebarConfig.ts";
import { siteConfig } from "./src/config/siteConfig.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.ts";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import iconManifest from "./src/generated/icon-manifest.json" with {
	type: "json",
};
import { siteMarkdownProcessor } from "./src/utils/markdown-processor.mjs";

const musicWidgetEnabled =
	sidebarConfig.enable &&
	sidebarConfig.components.some(
		(widget) => widget.type === "music" && widget.enable,
	);
const musicFeatureEnabled =
	resolveMusicOptions(musicConfig) !== null && musicWidgetEnabled;

const musicSidebarModuleId = "virtual:shirine-music-sidebar";
const resolvedMusicSidebarModuleId = `\0${musicSidebarModuleId}`;

const optionalMusicSidebarPlugin = {
	name: "shirine-optional-music-sidebar",
	enforce: "pre",
	resolveId(source) {
		return source === musicSidebarModuleId
			? resolvedMusicSidebarModuleId
			: null;
	},
	load(id) {
		if (id !== resolvedMusicSidebarModuleId) return null;
		return musicFeatureEnabled
			? 'export { default } from "/src/components/organisms/music/MusicSidebar.astro";'
			: "export default null;";
	},
	generateBundle(_options, bundle) {
		if (!musicFeatureEnabled) {
			for (const fileName of Object.keys(bundle)) {
				if (
					fileName.includes("MusicSidebarClient") ||
					fileName.startsWith("_astro/music.") ||
					fileName.includes("/music.")
				) {
					delete bundle[fileName];
				}
			}
		}
	},
};

const isBuildCommand = process.argv.includes("build");
const isDevCommand = process.argv.includes("dev");

const prismVirtualPlugin = {
	name: "vite-plugin-astro-cloudflare-prism-virtual",
	resolveId(id) {
		if (id === "virtual:astro-cloudflare:prism") {
			return "\0virtual:astro-cloudflare:prism";
		}
	},
	load(id) {
		if (id === "\0virtual:astro-cloudflare:prism") {
			return "export const bundledLanguages = {};\nexport default bundledLanguages;";
		}
	},
};

const shikiVirtualPlugin = {
	name: "vite-plugin-astro-cloudflare-shiki-virtual",
	enforce: "pre",
	resolveId(id) {
		if (id.includes("rehype-shiki")) {
			return "\0virtual:astro-cloudflare:rehype-shiki";
		}
	},
	load(id) {
		if (id === "\0virtual:astro-cloudflare:rehype-shiki") {
			return "export const rehypeShiki = () => () => {};\nexport default rehypeShiki;";
		}
	},
};

const cloudflareWorkerManifestIntegration = {
	name: "astro-cloudflare-worker-manifest-fix",
	hooks: {
		"astro:build:ssr": ({ manifest }) => {
			cloudflareWorkerManifestIntegration._manifest = manifest;
		},
		"astro:build:done": ({ dir, logger }) => {
			const ssrManifest = cloudflareWorkerManifestIntegration._manifest;
			if (!ssrManifest) return;
			const workerFile = join(fileURLToPath(dir), "_worker.js", "index.js");
			if (!existsSync(workerFile)) return;
			let content = readFileSync(workerFile, "utf-8");
			if (content.includes("@@ASTRO_MANIFEST_REPLACE@@")) {
				const replaceExp = /['"`]@@ASTRO_MANIFEST_REPLACE@@['"`]/g;
				content = content.replace(replaceExp, () => JSON.stringify(ssrManifest));
				writeFileSync(workerFile, content, "utf-8");
				logger.info("Injected serialized SSR manifest into Cloudflare worker bundle.");
			}

			const routesFile = join(fileURLToPath(dir), "_routes.json");
			const routesConfig = {
				version: 1,
				include: ["/*"],
				exclude: [
					"/_astro/*",
					"/assets/*",
					"/images/*",
					"/favicon/*",
					"/logo/*",
					"/pio/*"
				]
			};
			writeFileSync(routesFile, JSON.stringify(routesConfig, null, 2), "utf-8");
			logger.info("Generated optimized wildcard _routes.json for Cloudflare Pages.");
		},
	},
};

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site,
	base: siteConfig.base ?? "/",
	output: "server",
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
		imageService: "passthrough",
	}),
	trailingSlash: "always",
	integrations: [
		swup({
			theme: false,
			ignore: 'a[href="#"]',
			animationClass: "transition-swup-",
			containers: ["main", "#toc"],
			smoothScrolling: true,
			cache: true,
			preload: true,
			accessibility: true,
			updateHead: {
				awaitAssets: false,
				persistTags:
					"link[rel=stylesheet]:not([data-swup-optional]), style:not([data-swup-optional])",
			},
			updateBodyClass: false,
			globalInstance: true,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => Boolean(event.state?.url?.includes("#")),
		}),
		icon({
			include: iconManifest,
		}),
		expressiveCode({
			themes: [
				expressiveCodeConfig.lightTheme ?? expressiveCodeConfig.theme,
				expressiveCodeConfig.darkTheme ?? expressiveCodeConfig.theme,
			],
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					shellsession: {
						showLineNumbers: false,
					},
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily: "var(--m3e-font-mono-family)",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-topbar-bg)",
					editorTabBarBackground: "var(--codeblock-topbar-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-topbar-bg)",
					terminalTitlebarBorderBottomColor: "none",
				},
			},
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		svelte({
			compilerOptions: {
				cssHash: ({ css, hash }) => `svelte-${hash(css)}`,
				warningFilter: () => !isDevCommand,
			},
		}),
		mdx({
			syntaxHighlight: false,
			optimize: true,
		}),
		cloudflareWorkerManifestIntegration,
	],
	markdown: {
		syntaxHighlight: false,
		processor: siteMarkdownProcessor,
	},
	vite: {
		resolve: {
			alias: [
				{
					find: "@",
					replacement: fileURLToPath(new URL("./src", import.meta.url)),
				},
				{
					find: /^@iconify\/svelte$/,
					replacement: fileURLToPath(
						new URL(
							"./src/components/atoms/display/Icon.svelte",
							import.meta.url,
						),
					),
				},
			],
		},
		plugins: [
			optionalMusicSidebarPlugin,
			prismVirtualPlugin,
			shikiVirtualPlugin,
			tailwindcss(),
		],
		optimizeDeps: {
			include: [
				"mermaid",
				"@panzoom/panzoom",
				"overlayscrollbars",
				"@fancyapps/ui",
			],
		},
		build: {
			minify: true,
		},
	},
});
