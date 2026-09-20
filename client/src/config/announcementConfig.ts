import type { AnnouncementConfig } from "@/types/announcementConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 公告栏配置
 * 组件显示由 sidebarConfig 统一控制
 */
export const announcementConfig: AnnouncementConfig = withUserConfig(
	"announcement",
	{
		title: "", // 公告标题，填空使用 i18n 字符串 Key.announcement
		content: "The only way to do great work is to love what you do", // 公告内容
		closable: true, // 允许用户关闭公告
		link: {
			enable: true, // 启用链接
			text: "GitHub", // 链接文本
			url: "https://github.com/yiran168/Shirine", // 链接 URL
			external: true, // 外部链接
		},
		links: [
			{
				enable: true,
				text: "GitHub",
				url: "https://github.com/yiran168/Shirine",
				external: true,
			},
			{
				enable: true,
				text: "Steam",
				url: "https://store.steampowered.com",
				external: true,
			},
			{
				enable: true,
				text: "Facebook",
				url: "https://www.facebook.com",
				external: true,
			},
		],
	},
);
