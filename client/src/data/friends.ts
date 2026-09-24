/**
 * Shirine 友情链接数据配置
 * 用于管理友情链接页面的数据：src/pages/friends.astro → organisms/FriendSection。
 *
 * 添加友链：在 friendsData 中追加一项即可，页面 / 筛选标签自动生成。
 * tags 会聚合为页面顶部的筛选 chip（OR 命中：选中多个标签时命中任一即显示）。
 */
export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
}

// 友情链接数据
export const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "Mizuki",
		imgurl: "/assets/avatars/avatar_01.webp",
		desc: "Another Fuwari-based blog theme with docs",
		siteurl: "https://mizuki.mysqil.com",
		tags: ["Blog", "Theme"],
	},
	{
		id: 2,
		title: "Astro",
		imgurl: "/assets/avatars/avatar_02.webp",
		desc: "The web framework for content-driven websites",
		siteurl: "https://astro.build",
		tags: ["Framework"],
	},
	{
		id: 3,
		title: "Material 3",
		imgurl: "/assets/avatars/avatar_03.webp",
		desc: "Material Design 3 — the next generation of Material Design",
		siteurl: "https://m3.material.io",
		tags: ["Design"],
	},
];

// 获取所有友情链接数据（稳定顺序，测试可复现）
export function getFriendsList(): FriendItem[] {
	return friendsData;
}

// 获取随机排序的友情链接数据（避免固定排序，按需使用）
export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
