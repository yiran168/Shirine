import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { devicesConfig } from "@/config/devicesConfig";
import { projectsConfig } from "@/config/projectsConfig";
import { skillsConfig } from "@/config/skillsConfig";
import { timelineConfig } from "@/config/timelineConfig";
import type {
	NavBarConfig,
	NavBarConfigOverride,
	NavBarLink,
	NavBarLinkOverride,
} from "@/types/navBarConfig";
import { getUserConfig } from "../utils/config-overlay.ts";

/**
 * 导航栏配置（统一单一来源）。
 * - LinkPresets：命名链接预设表 —— 名称 / 地址 / 图标单点维护，可整体复用；
 * - navBarConfig：导航结构 —— 顺序 + 分组（children 子菜单），
 *   同时驱动顶栏下拉菜单与全端导航抽屉。
 * 新增入口：先在 LinkPresets 登记预设，再在 navBarConfig.links 按序引用。
 *
 * 内容仓可用 `config/nav-bar.yaml` 整体替换 `links`，写法见 `NavBarLinkOverride`。
 */
export function getLinkPresets(lang?: string): Record<string, NavBarLink> {
	return {
		Home: {
			name: i18n(I18nKey.home, lang),
			url: "/",
			icon: "material-symbols:home-outline-rounded",
			pageKey: "home",
		},
		Archive: {
			name: i18n(I18nKey.archive, lang),
			url: "/archive/",
			icon: "material-symbols:archive-outline-rounded",
			pageKey: "archive",
		},
		Friends: {
			name: i18n(I18nKey.friends, lang),
			url: "/friends/",
			icon: "material-symbols:handshake-outline-rounded",
			pageKey: "friends",
		},
		Moments: {
			name: i18n(I18nKey.moments, lang),
			url: "/moments/",
			icon: "material-symbols:auto-awesome-outline-rounded",
			pageKey: "moments",
		},
		Anime: {
			name: i18n(I18nKey.anime, lang),
			url: "/anime/",
			icon: "material-symbols:live-tv-outline-rounded",
			pageKey: "anime",
		},
		Compass: {
			name: i18n(I18nKey.compass, lang),
			url: "/compass/",
			icon: "material-symbols:explore-rounded",
			pageKey: "compass",
		},
		Skills: {
			name: i18n(I18nKey.skills, lang),
			url: "/skills/",
			icon: "material-symbols:workspaces-outline-rounded",
			pageKey: "skills",
		},
		Projects: {
			name: i18n(I18nKey.projects, lang),
			url: "/projects/",
			icon: "material-symbols:deployed-code-outline-rounded",
			pageKey: "projects",
		},
		Devices: {
			name: i18n(I18nKey.devices, lang),
			url: "/devices/",
			icon: "material-symbols:devices-rounded",
			pageKey: "devices",
		},
		Timeline: {
			name: i18n(I18nKey.timeline, lang),
			url: "/timeline/",
			icon: "material-symbols:timeline-rounded",
			pageKey: "timeline",
		},
		Albums: {
			name: i18n(I18nKey.albums, lang),
			url: "/albums/",
			icon: "material-symbols:photo-library-outline-rounded",
			pageKey: "albums",
		},
		Categories: {
			name: i18n(I18nKey.categories, lang),
			url: "/categories/",
			icon: "material-symbols:folder-outline-rounded",
			pageKey: "categories",
		},
		Tags: {
			name: i18n(I18nKey.tags, lang),
			url: "/tags/",
			icon: "material-symbols:tag-rounded",
			pageKey: "tags",
		},
		About: {
			name: i18n(I18nKey.about, lang),
			url: "/about/",
			icon: "material-symbols:info-outline-rounded",
			pageKey: "about",
		},
		GitHub: {
			name: "GitHub",
			url: "https://github.com/yiran168/Shirine",
			icon: "fa6-brands:github",
			external: true,
			pageKey: "github",
		},
	};
}

export const LinkPresets: Record<string, NavBarLink> = getLinkPresets();

export function getDynamicNavBarConfig(lang?: string): NavBarConfig {
	const presets = getLinkPresets(lang);
	return {
		links: [
			presets.Home,
			presets.Archive,
			presets.Friends,
			presets.Moments,
			presets.Anime,
			presets.Compass,
			presets.Albums,
			{
				name: i18n(I18nKey.more, lang),
				icon: "material-symbols:apps-rounded",
				pageKey: "more",
				children: [
					...(timelineConfig.enable ? [presets.Timeline] : []),
					...(projectsConfig.enable ? [presets.Projects] : []),
					...(devicesConfig.enable ? [presets.Devices] : []),
					...(skillsConfig.enable ? [presets.Skills] : []),
					presets.About,
					presets.GitHub,
				],
			},
		],
	};
}

const defaultNavBarConfig: NavBarConfig = getDynamicNavBarConfig();

/** `$t:home` 形式的 i18n 引用前缀；不带前缀的 name 一律按字面量处理。 */
const I18N_REFERENCE_PREFIX = "$t:";

function fail(message: string): never {
	throw new Error(`[config] nav-bar：${message}`);
}

function resolveName(name: string): string {
	if (!name.startsWith(I18N_REFERENCE_PREFIX)) return name;

	const key = name.slice(I18N_REFERENCE_PREFIX.length);
	if (!Object.hasOwn(I18nKey, key)) {
		fail(
			`未知的 i18n 词条 "${key}"。可用词条见 src/i18n/i18nKey.ts；` +
				" 若本意是普通文本，去掉开头的 $t: 即可。",
		);
	}
	return i18n(I18nKey[key as keyof typeof I18nKey]);
}

/**
 * 把内容仓的声明式导航条目还原成 `NavBarLink`。
 *
 * 预设名与 i18n 词条只有在这里才能校验（`LinkPresets` 与 `I18nKey` 都住在代码仓，
 * 生成期的 Node 脚本受路径别名所限读不到），因此错误在构建加载配置时抛出。
 */
export function resolveNavBarLinks(
	entries: readonly NavBarLinkOverride[],
	presets: Record<string, NavBarLink> = LinkPresets,
): NavBarLink[] {
	return entries.map((entry) => {
		let base: NavBarLink | null = null;
		if (entry.preset !== undefined) {
			base = presets[entry.preset] ?? null;
			if (!base) {
				fail(
					`未知的预设 "${entry.preset}"。可用预设：${Object.keys(presets).join("、")}。`,
				);
			}
		}

		const name =
			entry.name !== undefined ? resolveName(entry.name) : base?.name;
		if (name === undefined) {
			fail("每个条目都需要 name，或用 preset 引用一个内置预设。");
		}

		// 未声明 children 时沿用预设自带的子菜单（已由 ...base 带入）。
		return {
			...base,
			name,
			...(entry.url !== undefined ? { url: entry.url } : {}),
			...(entry.icon !== undefined ? { icon: entry.icon } : {}),
			...(entry.pageKey !== undefined ? { pageKey: entry.pageKey } : {}),
			...(entry.external !== undefined ? { external: entry.external } : {}),
			...(entry.children
				? { children: resolveNavBarLinks(entry.children, presets) }
				: {}),
		};
	});
}

const userNavBar = getUserConfig("navBar") as NavBarConfigOverride | undefined;

export const navBarConfig: NavBarConfig = userNavBar
	? { links: resolveNavBarLinks(userNavBar.links) }
	: defaultNavBarConfig;
