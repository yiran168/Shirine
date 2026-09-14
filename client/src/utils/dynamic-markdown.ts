import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

export function renderDynamicMarkdown(content: string): string {
	if (!content) return "";
	const rendered = md.render(content);
	return sanitizeHtml(rendered, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat([
			"img",
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
			a: ["href", "name", "target", "rel"],
			video: ["src", "controls", "width", "height", "autoplay", "loop", "muted"],
			audio: ["src", "controls", "autoplay", "loop", "muted"],
			source: ["src", "type"],
		},
	});
}
