/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

declare module "virtual:shirine-music-sidebar" {
	const component:
		| typeof import("@components/organisms/music/MusicSidebar.astro").default
		| null;
	export default component;
}

declare module "*scripts/anime/providers/bangumi.mjs" {
	export function fetchBangumiData(config: unknown): Promise<{
		provider: "bangumi";
		accountRef: string;
		rawItems: unknown[];
	}>;
}

declare module "*scripts/anime/providers/bilibili.mjs" {
	export function fetchBilibiliData(config: unknown): Promise<{
		provider: "bilibili";
		accountRef: string;
		rawItems: unknown[];
	}>;
}

declare module "hast" {
	export type Element = any;
	export type Root = any;
	export type Node = any;
}

declare module "mdast" {
	export type Root = any;
	export type Node = any;
}

declare module "markdown-it" {
	const MarkdownIt: any;
	export default MarkdownIt;
}

declare module "sanitize-html" {
	const sanitizeHtml: any;
	export default sanitizeHtml;
}

declare module "qrcode" {
	export function toDataURL(text: string, options?: any): Promise<string>;
	export function toString(text: string, options?: any): Promise<string>;
	export function toCanvas(canvas: any, text: string, options?: any): Promise<void>;
}

