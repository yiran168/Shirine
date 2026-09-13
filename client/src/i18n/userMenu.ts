/**
 * User Menu & Avatar i18n dictionary
 * Strictly following specification:
 * 简体中文: 登录 | 注册账号 | 每日签到 | 今日已签到 | 更换头像 | 退出登录 | 管理后台
 * 繁體中文: 登入 | 註冊帳號 | 每日簽到 | 今日已簽到 | 更換頭像 | 退出登入 | 管理後台
 * English: Sign in | Sign up | Daily check-in | Checked in today | Change avatar | Sign out | Admin panel
 * 日本語: ログイン | 新規登録 | 毎日チェックイン | チェックイン済み | アバター変更 | ログアウト | 管理画面
 */

export const userMenuI18n = {
  zh_CN: {
    signIn: "登录",
    signUp: "注册账号",
    dailyCheckin: "每日签到",
    checkedInToday: "今日已签到",
    changeAvatar: "更换头像",
    signOut: "退出登录",
    adminPanel: "管理后台",
    checkinSuccess: "签到成功！获得 +{points} 积分",
    selectAvatar: "更换二次元头像",
    currentAvatar: "当前头像",
    cancel: "取消",
    confirm: "确认更换",
  },
  zh_TW: {
    signIn: "登入",
    signUp: "註冊帳號",
    dailyCheckin: "每日簽到",
    checkedInToday: "今日已簽到",
    changeAvatar: "更換頭像",
    signOut: "退出登入",
    adminPanel: "管理後台",
    checkinSuccess: "簽到成功！獲得 +{points} 積分",
    selectAvatar: "更換二次元頭像",
    currentAvatar: "當前頭像",
    cancel: "取消",
    confirm: "確認更換",
  },
  en: {
    signIn: "Sign in",
    signUp: "Sign up",
    dailyCheckin: "Daily check-in",
    checkedInToday: "Checked in today",
    changeAvatar: "Change avatar",
    signOut: "Sign out",
    adminPanel: "Admin panel",
    checkinSuccess: "Checked in! Earned +{points} points",
    selectAvatar: "Change Anime Avatar",
    currentAvatar: "Current Avatar",
    cancel: "Cancel",
    confirm: "Confirm",
  },
  ja: {
    signIn: "ログイン",
    signUp: "新規登録",
    dailyCheckin: "毎日チェックイン",
    checkedInToday: "チェックイン済み",
    changeAvatar: "アバター変更",
    signOut: "ログアウト",
    adminPanel: "管理画面",
    checkinSuccess: "チェックイン完了！+{points} ポイント獲得",
    selectAvatar: "アバター変更",
    currentAvatar: "現在のアバター",
    cancel: "キャンセル",
    confirm: "変更を確定",
  },
} as const;

export type UserMenuLang = keyof typeof userMenuI18n;

export function getUserMenuText(lang: string = "zh_CN") {
  const normalized = lang.replace("-", "_") as UserMenuLang;
  return userMenuI18n[normalized] || userMenuI18n.zh_CN;
}
