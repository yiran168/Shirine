import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

export function renderDynamicMarkdown(content: string): string {
	if (!content) return "";
	return md.render(content);
}
