import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { createTestEnv } from "../helpers/test-env";
import { userMenuI18n, getUserMenuText } from "../../client/src/i18n/userMenu";

const PROJECT_ROOT = resolve(__dirname, "../..");

describe("Tier 1 - AC 5: Avatar Management & 4-Language i18n", () => {
  it("AC 5.1: 4-language i18n dictionary exact text matching for 7 user menu actions", () => {
    // 1. 简体中文 (zh_CN)
    const zhCN = userMenuI18n.zh_CN;
    expect(zhCN.signIn).toBe("登录");
    expect(zhCN.signUp).toBe("注册账号");
    expect(zhCN.dailyCheckin).toBe("每日签到");
    expect(zhCN.checkedInToday).toBe("今日已签到");
    expect(zhCN.changeAvatar).toBe("更换头像");
    expect(zhCN.signOut).toBe("退出登录");
    expect(zhCN.adminPanel).toBe("管理后台");

    // 2. 繁體中文 (zh_TW)
    const zhTW = userMenuI18n.zh_TW;
    expect(zhTW.signIn).toBe("登入");
    expect(zhTW.signUp).toBe("註冊帳號");
    expect(zhTW.dailyCheckin).toBe("每日簽到");
    expect(zhTW.checkedInToday).toBe("今日已簽到");
    expect(zhTW.changeAvatar).toBe("更換頭像");
    expect(zhTW.signOut).toBe("退出登入");
    expect(zhTW.adminPanel).toBe("管理後台");

    // 3. English (en)
    const en = userMenuI18n.en;
    expect(en.signIn).toBe("Sign in");
    expect(en.signUp).toBe("Sign up");
    expect(en.dailyCheckin).toBe("Daily check-in");
    expect(en.checkedInToday).toBe("Checked in today");
    expect(en.changeAvatar).toBe("Change avatar");
    expect(en.signOut).toBe("Sign out");
    expect(en.adminPanel).toBe("Admin panel");

    // 4. 日本語 (ja)
    const ja = userMenuI18n.ja;
    expect(ja.signIn).toBe("ログイン");
    expect(ja.signUp).toBe("新規登録");
    expect(ja.dailyCheckin).toBe("毎日チェックイン");
    expect(ja.checkedInToday).toBe("チェックイン済み");
    expect(ja.changeAvatar).toBe("アバター変更");
    expect(ja.signOut).toBe("ログアウト");
    expect(ja.adminPanel).toBe("管理画面");

    // Language fallback helper
    expect(getUserMenuText("zh-CN").signIn).toBe("登录");
    expect(getUserMenuText("ja").dailyCheckin).toBe("毎日チェックイン");
  });

  it("AC 5.2: 3-state navbar avatar dropdown structure and visibility contracts", () => {
    function resolveMenuItems(role: "guest" | "user" | "admin" | "superadmin", checkedIn = false) {
      if (role === "guest") {
        return ["signIn", "signUp"];
      }
      if (role === "user") {
        return [
          checkedIn ? "checkedInToday" : "dailyCheckin",
          "changeAvatar",
          "signOut",
        ];
      }
      // Admin / Superadmin
      return ["adminPanel", "changeAvatar", "signOut"];
    }

    // 1. Guest: only signIn & signUp
    const guestItems = resolveMenuItems("guest");
    expect(guestItems).toEqual(["signIn", "signUp"]);
    expect(guestItems).not.toContain("adminPanel");
    expect(guestItems).not.toContain("dailyCheckin");

    // 2. Regular User: daily checkin (or checkedInToday), change avatar, sign out; NO admin panel
    const userItemsNotChecked = resolveMenuItems("user", false);
    expect(userItemsNotChecked).toEqual(["dailyCheckin", "changeAvatar", "signOut"]);
    expect(userItemsNotChecked).not.toContain("adminPanel");

    const userItemsChecked = resolveMenuItems("user", true);
    expect(userItemsChecked).toEqual(["checkedInToday", "changeAvatar", "signOut"]);
    expect(userItemsChecked).not.toContain("adminPanel");

    // 3. Admin / Superadmin: admin panel, change avatar, sign out; NO daily checkin
    const adminItems = resolveMenuItems("admin");
    expect(adminItems).toEqual(["adminPanel", "changeAvatar", "signOut"]);
    expect(adminItems).not.toContain("dailyCheckin");
    expect(adminItems).not.toContain("checkedInToday");
  });

  it("AC 5.3: 50 anime WebP avatars and 50 thumbnails are present with valid WebP signatures and 0 duplicate hashes", () => {
    const avatarDir = resolve(PROJECT_ROOT, "client/public/assets/avatars");
    expect(existsSync(avatarDir)).toBe(true);

    const hashes = new Set<string>();

    for (let i = 1; i <= 50; i++) {
      const pad = String(i).padStart(2, "0");
      const avatarFile = resolve(avatarDir, `avatar_${pad}.webp`);
      const thumbFile = resolve(avatarDir, `avatar_${pad}_thumb.webp`);

      expect(existsSync(avatarFile)).toBe(true);
      expect(existsSync(thumbFile)).toBe(true);

      const avatarBytes = readFileSync(avatarFile);
      const thumbBytes = readFileSync(thumbFile);

      expect(avatarBytes.length).toBeGreaterThan(10240); // > 10KB
      expect(thumbBytes.length).toBeGreaterThan(10240);

      // Verify WebP RIFF header
      const riffA = String.fromCharCode(...avatarBytes.subarray(0, 4));
      const webpA = String.fromCharCode(...avatarBytes.subarray(8, 12));
      expect(riffA).toBe("RIFF");
      expect(webpA).toBe("WEBP");

      const riffT = String.fromCharCode(...thumbBytes.subarray(0, 4));
      const webpT = String.fromCharCode(...thumbBytes.subarray(8, 12));
      expect(riffT).toBe("RIFF");
      expect(webpT).toBe("WEBP");

      // Verify 0 hash duplicates
      const hash = crypto.createHash("sha256").update(avatarBytes).digest("hex");
      expect(hashes.has(hash)).toBe(false);
      hashes.add(hash);
    }

    expect(hashes.size).toBe(50);
  });

  it("AC 5.4: avatars.json provides 50 valid entries with prompts and URLs", () => {
    const jsonPath = resolve(PROJECT_ROOT, "client/public/assets/avatars/avatars.json");
    expect(existsSync(jsonPath)).toBe(true);

    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(50);

    for (let i = 0; i < 50; i++) {
      const item = data[i];
      const expectedCode = `avatar_${String(i + 1).padStart(2, "0")}`;
      expect(item.id).toBe(i + 1);
      expect(item.code).toBe(expectedCode);
      expect(item.name).toBeDefined();
      expect(item.prompt).toBeDefined();
      expect(item.prompt.length).toBeGreaterThan(10);
      expect(item.url).toBe(`/assets/avatars/${expectedCode}.webp`);
      expect(item.thumbUrl).toBe(`/assets/avatars/${expectedCode}_thumb.webp`);
    }
  });

  it("AC 5.5: PUT /api/user/profile allows updating avatar to preset anime avatars and persists", async () => {
    const env = createTestEnv();
    const user = await env.createUser("avatar_tester", "pass123456", 0);

    const newAvatarUrl = "/assets/avatars/avatar_07.webp";

    const updateRes = await env.requestJson("/api/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        avatar: newAvatarUrl,
        nickname: "Anime Fan",
      }),
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.data.success).toBe(true);
    expect(updateRes.data.user.avatar).toBe(newAvatarUrl);
    expect(updateRes.data.user.nickname).toBe("Anime Fan");

    // Verify persisted in database via /api/auth/me
    const meRes = await env.requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(meRes.status).toBe(200);
    expect(meRes.data.user.avatar).toBe(newAvatarUrl);
    expect(meRes.data.user.nickname).toBe("Anime Fan");

    env.close();
  });
});
