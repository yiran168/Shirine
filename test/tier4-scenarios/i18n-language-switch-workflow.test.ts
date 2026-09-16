import { describe, it, expect } from "bun:test";
import { userMenuI18n, getUserMenuText } from "../../client/src/i18n/userMenu";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "../..");

describe("Tier 4 - Scenario: 4-Language Switching & UI Text Parity", () => {
  const supportedLangs = ["zh_CN", "zh_TW", "en", "ja"] as const;

  it("Verifies full parity of user menu action keys across all 4 supported languages", () => {
    const requiredKeys = [
      "signIn",
      "signUp",
      "dailyCheckin",
      "checkedInToday",
      "changeAvatar",
      "signOut",
      "adminPanel",
      "checkinSuccess",
      "selectAvatar",
      "currentAvatar",
      "cancel",
      "confirm",
    ] as const;

    for (const lang of supportedLangs) {
      const dict = userMenuI18n[lang];
      expect(dict).toBeDefined();

      for (const key of requiredKeys) {
        expect(dict[key]).toBeDefined();
        expect(typeof dict[key]).toBe("string");
        expect(dict[key].length).toBeGreaterThan(0);
      }
    }
  });

  it("Simulates user switching languages sequentially and receiving exact localized strings", () => {
    const scenarios = [
      {
        lang: "zh_CN",
        expected: {
          signIn: "登录",
          signUp: "注册账号",
          dailyCheckin: "每日签到",
          checkedInToday: "今日已签到",
          changeAvatar: "更换头像",
          signOut: "退出登录",
          adminPanel: "管理后台",
        },
      },
      {
        lang: "zh_TW",
        expected: {
          signIn: "登入",
          signUp: "註冊帳號",
          dailyCheckin: "每日簽到",
          checkedInToday: "今日已簽到",
          changeAvatar: "更換頭像",
          signOut: "退出登入",
          adminPanel: "管理後台",
        },
      },
      {
        lang: "en",
        expected: {
          signIn: "Sign in",
          signUp: "Sign up",
          dailyCheckin: "Daily check-in",
          checkedInToday: "Checked in today",
          changeAvatar: "Change avatar",
          signOut: "Sign out",
          adminPanel: "Admin panel",
        },
      },
      {
        lang: "ja",
        expected: {
          signIn: "ログイン",
          signUp: "新規登録",
          dailyCheckin: "毎日チェックイン",
          checkedInToday: "チェックイン済み",
          changeAvatar: "アバター変更",
          signOut: "ログアウト",
          adminPanel: "管理画面",
        },
      },
    ];

    for (const s of scenarios) {
      const texts = getUserMenuText(s.lang);
      expect(texts.signIn).toBe(s.expected.signIn);
      expect(texts.signUp).toBe(s.expected.signUp);
      expect(texts.dailyCheckin).toBe(s.expected.dailyCheckin);
      expect(texts.checkedInToday).toBe(s.expected.checkedInToday);
      expect(texts.changeAvatar).toBe(s.expected.changeAvatar);
      expect(texts.signOut).toBe(s.expected.signOut);
      expect(texts.adminPanel).toBe(s.expected.adminPanel);
    }
  });

  it("Verifies client translation files for the 4 core languages exist and are valid modules", () => {
    const langFiles = [
      "zh_CN.ts",
      "zh_TW.ts",
      "en.ts",
      "ja.ts",
    ];

    for (const file of langFiles) {
      const fullPath = resolve(PROJECT_ROOT, "client/src/i18n/languages", file);
      expect(existsSync(fullPath)).toBe(true);

      const content = readFileSync(fullPath, "utf-8");
      expect(content.length).toBeGreaterThan(500);
      expect(content).toContain("export const");
    }
  });
});
