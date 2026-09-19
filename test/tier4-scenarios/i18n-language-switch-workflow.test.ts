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

  it("Verifies admin dashboard i18n dictionary and language switcher components", async () => {
    const { adminI18n, getAdminText, SUPPORTED_LANGUAGES } = await import("../../client/src/i18n/adminI18n");
    expect(SUPPORTED_LANGUAGES.length).toBe(4);

    const adminKeys = [
      "adminTitle",
      "adminConsole",
      "backToSite",
      "signOut",
      "overview",
      "posts",
      "albums",
      "moments",
      "pages",
      "friends",
      "users",
      "settings",
      "defaultLang",
      "languageSwitched",
    ] as const;

    for (const lang of supportedLangs) {
      const dict = adminI18n[lang];
      expect(dict).toBeDefined();
      for (const key of adminKeys) {
        expect(dict[key]).toBeDefined();
        expect(typeof dict[key]).toBe("string");
        expect(dict[key].length).toBeGreaterThan(0);
      }
      const text = getAdminText(lang);
      expect(text.adminTitle).toBe("Shirine Admin");
    }

    // Verify frontend LanguageSwitch component exists
    const langSwitchPath = resolve(PROJECT_ROOT, "client/src/components/organisms/LanguageSwitch.svelte");
    expect(existsSync(langSwitchPath)).toBe(true);
    const langSwitchContent = readFileSync(langSwitchPath, "utf-8");
    expect(langSwitchContent).toContain("shirine_lang");
    expect(langSwitchContent).toContain("SUPPORTED_LANGUAGES");
  });

  it("Verifies dynamic i18n runtime switching and translation output parity", async () => {
    const { setSiteLang, i18n, getCurrentLang } = await import("../../client/src/i18n/translation");
    const I18nKey = (await import("../../client/src/i18n/i18nKey")).default;

    // Test zh_CN
    setSiteLang("zh_CN");
    expect(getCurrentLang()).toBe("zh_CN");
    expect(i18n(I18nKey.archive)).toBe("归档");
    expect(i18n(I18nKey.categories)).toBe("分类");
    expect(i18n(I18nKey.tags)).toBe("标签");

    // Test en
    setSiteLang("en");
    expect(getCurrentLang()).toBe("en");
    expect(i18n(I18nKey.archive)).toBe("Archive");
    expect(i18n(I18nKey.categories)).toBe("Categories");
    expect(i18n(I18nKey.tags)).toBe("Tags");

    // Test ja
    setSiteLang("ja");
    expect(getCurrentLang()).toBe("ja");
    expect(i18n(I18nKey.search)).toBe("検索");
    expect(i18n(I18nKey.categories)).toBe("カテゴリ");
    expect(i18n(I18nKey.tags)).toBe("タグ");

    // Test zh_TW
    setSiteLang("zh_TW");
    expect(getCurrentLang()).toBe("zh_TW");
    expect(i18n(I18nKey.archive)).toBe("彙整");
    expect(i18n(I18nKey.categories)).toBe("分類");
    expect(i18n(I18nKey.tags)).toBe("標籤");

    // Restore to zh_CN
    setSiteLang("zh_CN");
  });

  it("Verifies Astro SSR language middleware exists and correctly binds language runtime", () => {
    const middlewarePath = resolve(PROJECT_ROOT, "client/src/middleware.ts");
    expect(existsSync(middlewarePath)).toBe(true);
    const middlewareContent = readFileSync(middlewarePath, "utf-8");
    expect(middlewareContent).toContain("defineMiddleware");
    expect(middlewareContent).toContain("setSiteLang");
    expect(middlewareContent).toContain("shirine_lang");
    expect(middlewareContent).toContain("context.locals.lang");
  });

  it("Verifies admin config API persists defaultLang, lang, and themeStyle dynamically", async () => {
    const { createTestEnv } = await import("../helpers/test-env");
    const env = createTestEnv();
    const admin = await env.createSuperadmin("i18n_admin", "adminpass123");

    // Admin saves new language setting (ja) and themeStyle (expressive)
    const updateRes = await env.requestJson("/api/config/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({
        title: "Shirine Global",
        lang: "ja",
        defaultLang: "ja",
        themeStyle: "expressive",
      }),
    });
    expect(updateRes.status).toBe(200);

    // Verify GET /api/config/site reflects updated language and themeStyle
    const getRes = await env.requestJson("/api/config/site");
    expect(getRes.status).toBe(200);
    expect(getRes.data.data.lang).toBe("ja");
    expect(getRes.data.data.themeColor.style).toBe("expressive");
  });
});

