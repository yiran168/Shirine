import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	comparePublicationEntries,
	validatePublicationMetadata,
} from "@utils/content-date";
import { siteMarkdownProcessor } from "@utils/markdown-processor";
import { renderDynamicMarkdown } from "@utils/dynamic-markdown";
import { initPostIdMap } from "@utils/permalink-utils";
import { getCategoryUrl, getPostUrl, url } from "@utils/url-utils";
import type { FriendItem } from "../data/friends";
import { normalizeApiUrl, getAuthKey } from "@/services/api";

export { normalizeApiUrl, getAuthKey };

export function resolveApiBase(request?: Request): string {
	if (import.meta.env.PUBLIC_API_URL) {
		return normalizeApiUrl(import.meta.env.PUBLIC_API_URL);
	}
	if (request) {
		try {
			const u = new URL(request.url);
			if (u.port === "4321") {
				return "http://127.0.0.1:11498/api";
			}
			return `${u.origin}/api`;
		} catch {}
	}
	if (typeof window !== "undefined" && window.location) {
		if (window.location.port === "4321") {
			return "http://127.0.0.1:11498/api";
		}
		return `${window.location.origin}/api`;
	}
	return "http://127.0.0.1:11498/api";
}

const POSTS_CACHE_TTL_MS = 2_000;
let cachedPostsMap = new Map<string, { time: number; data: CollectionEntry<"posts">[] }>();
let inFlightPostsPromise = new Map<string, Promise<CollectionEntry<"posts">[]>>();

export function clearContentCache() {
	cachedPostsMap.clear();
	cachedMoments = null;
	cachedFriends = null;
	cachedAlbumsMap.clear();
	cachedDiscovery = null;
	cachedPages = null;
}

// Retrieve posts dynamically from backend API and sort them by publication date
async function getRawSortedPosts(request?: Request): Promise<CollectionEntry<"posts">[]> {
	const authKey = getAuthKey(request);
	const now = Date.now();
	const cached = cachedPostsMap.get(authKey);
	if (cached && now - cached.time < POSTS_CACHE_TTL_MS) {
		return cached.data;
	}

	const existingPromise = inFlightPostsPromise.get(authKey);
	if (existingPromise) {
		return existingPromise;
	}

	const fetchPromise = (async () => {
		const apiBase = resolveApiBase(request);

		let apiPosts: CollectionEntry<"posts">[] = [];
		let apiConnected = false;
		if (apiBase) {
			try {
				const headers: Record<string, string> = {};
				if (request) {
					const cookie = request.headers.get("cookie");
					if (cookie) headers["cookie"] = cookie;
					const auth = request.headers.get("authorization");
					if (auth) headers["authorization"] = auth;
				}

				const res = await fetch(`${apiBase.replace(/\/$/, "")}/posts?pageSize=500`, {
					headers,
					signal: AbortSignal.timeout(3000),
				});
				if (res.ok) {
					const json = await res.json();
					if (json.success && Array.isArray(json.data)) {
						apiConnected = true;
						apiPosts = json.data.map((p: any) => ({
							id: p.slug || String(p.id),
							body: p.content || "",
							collection: "posts" as const,
							data: {
								dbId: p.id,
								words: p.words ?? (p.content ? p.content.replace(/\s+/g, "").length : 0),
								title: p.title,
								published: new Date(p.createdAt),
								updated: p.updatedAt ? new Date(p.updatedAt) : undefined,
								description: p.description || "",
								image: p.image || "",
								category: p.category || "",
								tags: Array.isArray(p.tags) ? p.tags : [],
								pinned: Boolean(p.pinned),
								draft: Boolean(p.draft),
								comment: Boolean(p.commentEnabled ?? true),
								encrypted: Boolean(p.password || p.permissionType === "password" || p.encrypted || p.requiresPassword),
								password: p.password || undefined,
								passwordHint: p.passwordHint || undefined,
								permissionType: p.permissionType || "public",
								requiredPoints: p.requiredPoints || 0,
								isUnlocked: Boolean(p.isUnlocked),
								requiresPassword: Boolean(p.requiresPassword),
								hideHomeContent: Boolean(p.hideHomeContent),
								isPurchased: Boolean(p.isPurchased),
								isAuthenticated: Boolean(p.isAuthenticated),
								lockReason: p.lockReason || "",
								alias: p.alias,
								permalink: p.permalink,
								prevTitle: "",
								prevSlug: "",
								nextTitle: "",
								nextSlug: "",
							},
						}));
					}
				}
			} catch {}
		}

		let localPosts: CollectionEntry<"posts">[] = [];
		try {
			localPosts = await getCollection("posts", ({ data }) => {
				return import.meta.env.PROD ? data.draft !== true : true;
			});
		} catch {}
		const localPostsMap = new Map(localPosts.map((lp) => [lp.id, lp]));

		let postsToUse: CollectionEntry<"posts">[] = [];
		if (apiConnected && apiPosts.length > 0) {
			postsToUse = apiPosts.map((ap) => {
				const local = localPostsMap.get(ap.id);
				if (local) {
					if (!ap.body || ap.body.trim().length === 0) {
						ap.body = local.body;
					}
					if (!ap.filePath && local.filePath) {
						(ap as any).filePath = local.filePath;
					}
					if (!ap.data.image && local.data.image) {
						ap.data.image = local.data.image;
					}
				}
				return ap;
			});
		} else {
			postsToUse = localPosts;
		}

		for (const post of postsToUse) validatePublicationMetadata(post);
		const sorted = postsToUse.sort(comparePublicationEntries);
		initPostIdMap(sorted);

		cachedPostsMap.set(authKey, { time: Date.now(), data: sorted });
		return sorted;
	})();

	inFlightPostsPromise.set(authKey, fetchPromise);
	try {
		return await fetchPromise;
	} finally {
		inFlightPostsPromise.delete(authKey);
	}
}

export async function getSortedPosts(request?: Request): Promise<CollectionEntry<"posts">[]> {
	const sorted = await getRawSortedPosts(request);

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
		sorted[i].data.nextUrl = getPostUrl(sorted[i - 1]);
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
		sorted[i].data.prevUrl = getPostUrl(sorted[i + 1]);
	}

	return sorted;
}

export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
	url?: string;
};

export async function getSortedPostsList(request?: Request): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts(request);

	// delete post.body, attach pre-calculated URL
	const sortedPostsList: PostForList[] = sortedFullPosts.map((post) => ({
		slug: post.id,
		data: post.data,
		url: getPostUrl(post),
	}));

	return sortedPostsList;
}

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(request?: Request): Promise<Tag[]> {
	const allBlogPosts = await getRawSortedPosts(request);

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		(post.data.tags || []).forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(request?: Request): Promise<Category[]> {
	const allBlogPosts = await getRawSortedPosts(request);
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}

// // Moments (动态)：构建期渲染为序列化条目，供页面以 props 传给 Svelte 岛
export type MomentImage = {
	src: string;
	alt: string;
	/** Responsive list thumbnail; the original src remains the viewer/lightbox source. */
	thumbnailSrc?: string;
	thumbnailSrcset?: string;
};

export type MomentItem = {
	id: string;
	/** ISO 字符串（Date 无法跨岛序列化） */
	published: string;
	/** 正文 HTML（站点统一 markdown 插件链渲染） */
	html: string;
	pinned: boolean;
	location: string;
	/** 心情 Iconify 图标名 */
	mood: string;
	tags: string[];
	images: MomentImage[];
};

/** 渲染器按需创建并缓存（插件加载较重，全构建期只跑一次） */
let momentsRendererPromise: ReturnType<
	typeof siteMarkdownProcessor.createRenderer
> | null = null;

function withMomentThumbnails(image: any): MomentImage {
	if (typeof image === "string") {
		const resolved = image.startsWith("/") ? url(image) : image;
		return {
			src: resolved,
			thumbnailSrc: resolved,
			alt: "",
		};
	}
	const src = image?.src || "";
	const resolvedSrc = src.startsWith("/") ? url(src) : src;
	const resolvedThumb = image?.thumbnailSrc
		? image.thumbnailSrc.startsWith("/")
			? url(image.thumbnailSrc)
			: image.thumbnailSrc
		: resolvedSrc;

	return {
		...image,
		src: resolvedSrc,
		thumbnailSrc: resolvedThumb,
		thumbnailSrcset: undefined,
	};
}

let cachedMoments: { time: number; data: MomentItem[] } | null = null;
let inFlightMomentsPromise: Promise<MomentItem[]> | null = null;
const MOMENTS_CACHE_TTL_MS = 2_000;

export async function getSortedMoments(request?: Request): Promise<MomentItem[]> {
	const now = Date.now();
	if (cachedMoments && now - cachedMoments.time < MOMENTS_CACHE_TTL_MS) {
		return cachedMoments.data;
	}
	if (inFlightMomentsPromise) {
		return inFlightMomentsPromise;
	}

	const promise = (async () => {
		const apiBase = resolveApiBase(request);

		let apiMoments: MomentItem[] = [];
		let apiConnected = false;
		if (apiBase) {
			try {
				const headers: Record<string, string> = {};
				if (request) {
					const cookie = request.headers.get("cookie");
					if (cookie) headers["cookie"] = cookie;
					const auth = request.headers.get("authorization");
					if (auth) headers["authorization"] = auth;
				}
				const res = await fetch(`${apiBase.replace(/\/$/, "")}/moments`, {
					headers,
					signal: AbortSignal.timeout(3000),
				});
				if (res.ok) {
					const json = await res.json();
					if (json.success && Array.isArray(json.data)) {
						apiConnected = true;
						apiMoments = json.data.map((m: any) => ({
							id: String(m.id),
							published: new Date(m.createdAt).toISOString(),
							html: renderDynamicMarkdown(m.content || ""),
							pinned: Boolean(m.pinned),
							location: m.location || "",
							mood: m.mood || "",
							tags: Array.isArray(m.tags) ? m.tags : [],
							images: Array.isArray(m.images) ? m.images.map(withMomentThumbnails) : [],
						}));
					}
				}
			} catch {}
		}

		let momentsToUse: MomentItem[] = [];
		if (apiConnected && apiMoments.length > 0) {
			momentsToUse = apiMoments;
		} else {
			let entries: CollectionEntry<"moments">[] = [];
			try {
				entries = await getCollection("moments", ({ data }) => {
					return import.meta.env.PROD ? data.draft !== true : true;
				});
			} catch {}

			momentsRendererPromise ??= siteMarkdownProcessor.createRenderer({});
			const renderer = await momentsRendererPromise;

			momentsToUse = await Promise.all(
				entries.map(async (entry) => {
					const { code } = await renderer.render(entry.body ?? "", {
						frontmatter: entry.data as unknown as Record<string, unknown>,
					});
					return {
						id: entry.id,
						published: new Date(entry.data.published).toISOString(),
						html: code,
						pinned: entry.data.pinned,
						location: entry.data.location,
						mood: entry.data.mood,
						tags: entry.data.tags,
						images: entry.data.images.map(withMomentThumbnails),
					} satisfies MomentItem;
				}),
			);
		}

		const sorted = momentsToUse.sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return new Date(b.published).getTime() - new Date(a.published).getTime();
		});

		cachedMoments = { time: Date.now(), data: sorted };
		return sorted;
	})();

	inFlightMomentsPromise = promise;
	try {
		return await promise;
	} finally {
		inFlightMomentsPromise = null;
	}
}

let cachedFriends: { time: number; data: FriendItem[] } | null = null;
const FRIENDS_CACHE_TTL_MS = 2_000;

export async function getDynamicFriends(request?: Request): Promise<FriendItem[]> {
	const now = Date.now();
	if (cachedFriends && now - cachedFriends.time < FRIENDS_CACHE_TTL_MS) {
		return cachedFriends.data;
	}

	const apiBase = resolveApiBase(request);
	let allFriends: FriendItem[] = [];
	let apiConnected = false;

	if (apiBase) {
		try {
			const headers: Record<string, string> = {};
			if (request) {
				const cookie = request.headers.get("cookie");
				if (cookie) headers["cookie"] = cookie;
				const auth = request.headers.get("authorization");
				if (auth) headers["authorization"] = auth;
			}
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/friends`, {
				headers,
				signal: AbortSignal.timeout(3000),
			});
			if (res.ok) {
				const json = await res.json();
				const list = json.data || json.friends || [];
				if (Array.isArray(list)) {
					apiConnected = true;
					allFriends = list.map((f: any) => ({
						id: f.id,
						title: f.name,
						imgurl: f.avatar,
						desc: f.desc || "",
						siteurl: f.url,
						tags: Array.isArray(f.tags) ? f.tags : ["Friend"],
					}));
				}
			}
		} catch {}
	}

	if (!apiConnected || allFriends.length === 0) {
		try {
			const { getFriendsList } = await import("../data/friends");
			allFriends = [...getFriendsList()];
		} catch {
			allFriends = [];
		}
	}

	cachedFriends = { time: Date.now(), data: allFriends };
	return allFriends;
}

let cachedAlbumsMap = new Map<string, { time: number; data: any[] }>();
const ALBUMS_CACHE_TTL_MS = 2_000;

export async function getDynamicAlbums(request?: Request): Promise<any[]> {
	const authKey = getAuthKey(request);
	const now = Date.now();
	const cached = cachedAlbumsMap.get(authKey);
	if (cached && now - cached.time < ALBUMS_CACHE_TTL_MS) {
		return cached.data;
	}

	const apiBase = resolveApiBase(request);
	let dynamicAlbums: any[] = [];
	let apiConnected = false;

	if (apiBase) {
		try {
			const headers: Record<string, string> = {};
			if (request) {
				const cookie = request.headers.get("cookie");
				if (cookie) headers["cookie"] = cookie;
				const auth = request.headers.get("authorization");
				if (auth) headers["authorization"] = auth;
			}

			const res = await fetch(`${apiBase.replace(/\/$/, "")}/albums`, {
				headers,
				signal: AbortSignal.timeout(3000),
			});
			if (res.ok) {
				const json = await res.json();
				if (json.success && Array.isArray(json.data)) {
					apiConnected = true;
					dynamicAlbums = json.data.map((a: any) => ({
						id: a.slug || String(a.id),
						dbId: a.id,
						title: a.title,
						description: a.description || "",
						cover: a.cover || "",
						count: a.photoCount ?? 0,
						photoCount: a.photoCount ?? 0,
						permissionType: a.permissionType || "public",
						requiredPoints: a.requiredPoints || 0,
						isUnlocked: Boolean(a.isUnlocked),
						protected: a.permissionType !== "public" || Boolean(a.requiresPassword),
						requiresPassword: Boolean(a.requiresPassword),
						passwordHint: a.passwordHint || undefined,
						tags: Array.isArray(a.tags) ? a.tags : [],
						layout: a.layout || "masonry",
						columns: a.columns || 3,
						date: a.date || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : ""),
					}));
				}
			}
		} catch {}
	}

	let localAlbums: any[] = [];
	if (!apiConnected || dynamicAlbums.length === 0) {
		try {
			const { scanVisibleAlbums, toAlbumIndexItem } = await import("./album-scanner");
			localAlbums = scanVisibleAlbums().map(toAlbumIndexItem);
		} catch {}
	}

	const result = (apiConnected && dynamicAlbums.length > 0) ? dynamicAlbums : localAlbums;
	cachedAlbumsMap.set(authKey, { time: Date.now(), data: result });
	return result;
}

let cachedDiscovery: { time: number; data: any[] } | null = null;
let inFlightDiscoveryPromise: Promise<any[]> | null = null;
const DISCOVERY_CACHE_TTL_MS = 10_000;

export async function getDiscoveryCandidates(request?: Request): Promise<any[]> {
	const now = Date.now();
	if (cachedDiscovery && now - cachedDiscovery.time < DISCOVERY_CACHE_TTL_MS) {
		return cachedDiscovery.data;
	}
	if (inFlightDiscoveryPromise) {
		return inFlightDiscoveryPromise;
	}

	const promise = (async () => {
		const apiBase = resolveApiBase(request);
		let candidates: any[] = [];
		if (apiBase) {
			try {
				const headers: Record<string, string> = {};
				if (request) {
					const cookie = request.headers.get("cookie");
					if (cookie) headers["cookie"] = cookie;
					const auth = request.headers.get("authorization");
					if (auth) headers["authorization"] = auth;
				}
				const discRes = await fetch(`${apiBase}/posts?pageSize=10`, {
					headers,
					signal: AbortSignal.timeout(2000),
				});
				if (discRes.ok) {
					const discJson = await discRes.json();
					if (discJson.success && Array.isArray(discJson.data)) {
						candidates = discJson.data.map((p: any) => ({
							slug: p.slug || String(p.id),
							data: {
								title: p.title,
								published: new Date(p.createdAt),
								category: p.category || "",
								tags: Array.isArray(p.tags) ? p.tags : [],
							},
						}));
					}
				}
			} catch {}
		}
		cachedDiscovery = { time: Date.now(), data: candidates };
		return candidates;
	})();

	inFlightDiscoveryPromise = promise;
	try {
		return await promise;
	} finally {
		inFlightDiscoveryPromise = null;
	}
}

export async function getDynamicCompass(request?: Request): Promise<any[]> {
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && Array.isArray(siteCfg.compass)) {
					return siteCfg.compass;
				}
			}
		} catch {}
	}
	const { compassData } = await import("../data/compass");
	return compassData;
}

export async function getDynamicAnime(request?: Request): Promise<any[]> {
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && Array.isArray(siteCfg.anime)) {
					return siteCfg.anime;
				}
			}
		} catch {}
	}
	const { getAnimeList } = await import("./anime-data");
	return await getAnimeList();
}

export async function getDynamicProjects(request?: Request): Promise<any[]> {
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && Array.isArray(siteCfg.projects)) {
					return siteCfg.projects;
				}
			}
		} catch {}
	}
	const { projectsData } = await import("../data/projects");
	return projectsData;
}

export async function getDynamicDevices(request?: Request): Promise<any[]> {
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && Array.isArray(siteCfg.devices)) {
					return siteCfg.devices;
				}
			}
		} catch {}
	}
	const { devicesData } = await import("../data/devices");
	return devicesData;
}

export async function getDynamicSkills(request?: Request): Promise<any[]> {
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && Array.isArray(siteCfg.skills)) {
					return siteCfg.skills;
				}
			}
		} catch {}
	}
	const { skillsData } = await import("../data/skills");
	return skillsData;
}

export async function getDynamicFriendApplyInfo(request?: Request): Promise<{
	name: string;
	url: string;
	avatar: string;
	desc: string;
}> {
	const defaultInfo = {
		name: "Shirine",
		url: "https://github.com/yiran168/Shirine",
		avatar: "/assets/images/demo-avatar.webp",
		desc: "The rain remembers what the sky forgot to say.",
	};
	const apiBase = resolveApiBase(request);
	if (apiBase) {
		try {
			const res = await fetch(`${apiBase.replace(/\/$/, "")}/config/site`, {
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) {
				const json = await res.json();
				const siteCfg = json.data || json.site;
				if (siteCfg && siteCfg.friendApplyInfo && typeof siteCfg.friendApplyInfo === "object") {
					return {
						name: siteCfg.friendApplyInfo.name || defaultInfo.name,
						url: siteCfg.friendApplyInfo.url || defaultInfo.url,
						avatar: siteCfg.friendApplyInfo.avatar || defaultInfo.avatar,
						desc: siteCfg.friendApplyInfo.desc || defaultInfo.desc,
					};
				}
				if (siteCfg) {
					return {
						name: siteCfg.title || siteCfg.name || defaultInfo.name,
						url: siteCfg.site || defaultInfo.url,
						avatar: siteCfg.avatar || siteCfg.profile?.avatar || defaultInfo.avatar,
						desc: siteCfg.bio || siteCfg.profile?.bio || siteCfg.subtitle || defaultInfo.desc,
					};
				}
			}
		} catch {}
	}
	return defaultInfo;
}

let cachedPages: { time: number; data: any[] } | null = null;
let inFlightPagesPromise: Promise<any[]> | null = null;

export async function getDynamicPages(request?: Request): Promise<any[]> {
	const now = Date.now();
	if (cachedPages && now - cachedPages.time < 5_000) {
		return cachedPages.data;
	}
	if (inFlightPagesPromise) {
		return inFlightPagesPromise;
	}

	const promise = (async () => {
		const apiBase = resolveApiBase(request);
		if (apiBase) {
			try {
				const res = await fetch(`${apiBase.replace(/\/$/, "")}/pages`, {
					signal: AbortSignal.timeout(2000),
				});
				if (res.ok) {
					const json = await res.json();
					if (json.success && Array.isArray(json.data)) {
						const publishedPages = json.data.filter((p: any) => !p.draft && p.status !== "draft");
						cachedPages = { time: Date.now(), data: publishedPages };
						return publishedPages;
					}
				}
			} catch {}
		}
		cachedPages = { time: Date.now(), data: [] };
		return [];
	})();

	inFlightPagesPromise = promise;
	try {
		return await promise;
	} finally {
		inFlightPagesPromise = null;
	}
}
