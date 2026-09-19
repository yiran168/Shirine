// 循环依赖规避：navBarConfig 等配置消费 i18n，本模块只允许从具体文件导入 siteConfig，
// 禁止走 @/config barrel（见 src/config/README.md）
import { siteConfig } from "../config/siteConfig.ts";
import type I18nKey from "./i18nKey.ts";
import { en } from "./languages/en.ts";
import { es } from "./languages/es.ts";
import { id } from "./languages/id.ts";
import { ja } from "./languages/ja.ts";
import { ko } from "./languages/ko.ts";
import { th } from "./languages/th.ts";
import { tr } from "./languages/tr.ts";
import { vi } from "./languages/vi.ts";
import { zh_CN } from "./languages/zh_CN.ts";
import { zh_TW } from "./languages/zh_TW.ts";

export type Translation = {
	[K in I18nKey]: string;
};

const defaultTranslation = zh_CN;

const map: { [key: string]: Translation } = {
	es: es,
	en: en,
	en_us: en,
	en_gb: en,
	en_au: en,
	zh_cn: zh_CN,
	zh_tw: zh_TW,
	ja: ja,
	ja_jp: ja,
	ko: ko,
	ko_kr: ko,
	th: th,
	th_th: th,
	vi: vi,
	vi_vn: vi,
	id: id,
	tr: tr,
	tr_tr: tr,
};

let activeRuntimeLang: string | null = null;

export function setSiteLang(lang: string) {
	activeRuntimeLang = lang;
	if (siteConfig) {
		siteConfig.lang = lang as any;
	}
}

export function getCurrentLang(): string {
	if (typeof window !== "undefined") {
		const stored = localStorage.getItem("shirine_lang");
		if (stored) return stored;
		const htmlLang = document.documentElement.lang?.replace("-", "_");
		if (htmlLang) return htmlLang;
	}
	return activeRuntimeLang || siteConfig.lang || "zh_CN";
}

export function getTranslation(lang: string): Translation {
	return map[lang.toLowerCase()] || defaultTranslation;
}

export function i18n(key: I18nKey, langOverride?: string): string {
	const lang = langOverride || getCurrentLang();
	return getTranslation(lang)[key];
}

if (typeof window !== "undefined") {
	window.addEventListener("shirine-lang-change", (e: Event) => {
		const detail = (e as CustomEvent).detail;
		if (detail?.lang) {
			setSiteLang(detail.lang);
		}
	});
}
