/**
 * Permission UI i18n dictionary
 * 4-language support: zh_CN, zh_TW, en, ja
 *
 * Requirements:
 * - 登录后可见 (Login required to view)
 * - 需 N 积分解锁 (Requires N points to unlock)
 * - 已解锁 (Unlocked)
 */

export const permissionI18n = {
  zh_CN: {
    loginRequired: "登录后可见",
    loginRequiredBadge: "登录可见",
    pointsRequired: "需 {points} 积分解锁",
    pointsRequiredBadge: "{points} 积分解锁",
    unlocked: "已解锁",
    overlayLoginRequired: "登录后可见",
    overlayPointsRequired: "需 {points} 积分解锁",
    badgeLoginRequired: "登录可见",
    badgePointsRequired: "{points} 积分解锁",
    badgeUnlocked: "已解锁",
  },
  zh_TW: {
    loginRequired: "登入後可見",
    loginRequiredBadge: "登入可見",
    pointsRequired: "需 {points} 積分解鎖",
    pointsRequiredBadge: "{points} 積分解鎖",
    unlocked: "已解鎖",
    overlayLoginRequired: "登入後可見",
    overlayPointsRequired: "需 {points} 積分解鎖",
    badgeLoginRequired: "登入可見",
    badgePointsRequired: "{points} 積分解鎖",
    badgeUnlocked: "已解鎖",
  },
  en: {
    loginRequired: "Login to view",
    loginRequiredBadge: "Login required",
    pointsRequired: "Requires {points} points to unlock",
    pointsRequiredBadge: "{points} points to unlock",
    unlocked: "Unlocked",
    overlayLoginRequired: "Login to view",
    overlayPointsRequired: "Requires {points} points to unlock",
    badgeLoginRequired: "Login required",
    badgePointsRequired: "{points} points to unlock",
    badgeUnlocked: "Unlocked",
  },
  ja: {
    loginRequired: "ログイン後に表示",
    loginRequiredBadge: "ログインで閲覧",
    pointsRequired: "アンロックに {points} ポイント必要",
    pointsRequiredBadge: "{points} ポイントでアンロック",
    unlocked: "アンロック済み",
    overlayLoginRequired: "ログイン後に表示",
    overlayPointsRequired: "アンロックに {points} ポイント必要",
    badgeLoginRequired: "ログインで閲覧",
    badgePointsRequired: "{points} ポイントでアンロック",
    badgeUnlocked: "アンロック済み",
  },
} as const;

export type PermissionLang = keyof typeof permissionI18n;

export function normalizePermissionLang(lang?: string): PermissionLang {
  if (!lang) return "zh_CN";
  const lower = lang.toLowerCase().replace("-", "_");
  if (lower.startsWith("zh_tw") || lower.startsWith("zh_hk") || lower.startsWith("zh_mo")) return "zh_TW";
  if (lower.startsWith("zh")) return "zh_CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  return "zh_CN";
}

export function getPermissionText(lang?: string) {
  const normalized = normalizePermissionLang(lang);
  return permissionI18n[normalized] || permissionI18n.zh_CN;
}

export function formatPointsRequired(points: number, lang?: string): string {
  const t = getPermissionText(lang);
  return t.overlayPointsRequired.replace("{points}", String(points));
}

export function formatBadgePointsRequired(points: number, lang?: string): string {
  const t = getPermissionText(lang);
  return t.badgePointsRequired.replace("{points}", String(points));
}
