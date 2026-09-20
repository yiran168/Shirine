import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

export function preprocessVideoDirectives(content: string): string {
	if (!content) return "";

	// 1. Bilibili directive: ::bilibili{bvid="..." p=1} or ::bilibili[BVxxx]
	let processed = content.replace(
		/::bilibili(?:\{([^}]*)\}|\[([a-zA-Z0-9_-]+)\])/g,
		(_, attrs, bvidDirect) => {
			let bvid = bvidDirect || "";
			let page = 1;
			if (attrs) {
				const bvidMatch = attrs.match(/bvid=["']?([a-zA-Z0-9_-]+)["']?/);
				if (bvidMatch) bvid = bvidMatch[1];
				const pageMatch = attrs.match(/p(?:age)?=["']?(\d+)["']?/);
				if (pageMatch) page = parseInt(pageMatch[1], 10);
			}
			if (!bvid) return "";
			return `<div class="video-embed video-embed--bilibili my-4 aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-[var(--outline-variant)]/20 bg-black/5"><iframe src="https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${page}&high_quality=1&danmaku=0" class="w-full h-full border-0" allowfullscreen="true" scrolling="no" frameborder="0" sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts"></iframe></div>`;
		}
	);

	// 2. YouTube directive: ::youtube{id="..."} or ::youtube[id]
	processed = processed.replace(
		/::youtube(?:\{([^}]*)\}|\[([a-zA-Z0-9_-]+)\])/g,
		(_, attrs, idDirect) => {
			let id = idDirect || "";
			if (attrs) {
				const idMatch = attrs.match(/id=["']?([a-zA-Z0-9_-]+)["']?/);
				if (idMatch) id = idMatch[1];
			}
			if (!id) return "";
			return `<div class="video-embed video-embed--youtube my-4 aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-[var(--outline-variant)]/20 bg-black/5"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1" class="w-full h-full border-0" allowfullscreen="true" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
		}
	);

	return processed;
}

export function renderDynamicMarkdown(content: string): string {
	if (!content) return "";
	const preprocessed = preprocessVideoDirectives(content);
	const rendered = md.render(preprocessed);
	return sanitizeHtml(rendered, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat([
			"img",
			"iframe",
			"details",
			"summary",
			"code",
			"pre",
			"span",
			"div",
			"kbd",
			"samp",
			"sub",
			"sup",
			"mark",
			"video",
			"audio",
			"source",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
		]),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			"*": ["class", "id", "style", "title", "aria-*", "data-*"],
			img: ["src", "alt", "width", "height", "loading"],
			iframe: [
				"src",
				"width",
				"height",
				"frameborder",
				"allowfullscreen",
				"allow",
				"scrolling",
				"sandbox",
				"title",
				"class",
				"style",
			],
			a: ["href", "name", "target", "rel"],
			video: ["src", "controls", "width", "height", "autoplay", "loop", "muted"],
			audio: ["src", "controls", "autoplay", "loop", "muted"],
			source: ["src", "type"],
		},
		allowedIframeHostnames: [
			"player.bilibili.com",
			"www.bilibili.com",
			"bilibili.com",
			"www.youtube.com",
			"youtube.com",
			"www.youtube-nocookie.com",
		],
	});
}
