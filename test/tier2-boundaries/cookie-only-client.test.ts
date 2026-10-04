import { expect, test } from "bun:test";
import { authApi, userApi } from "../../client/src/services/api";
import { browserStorage } from "../../client/src/utils/browser-storage";

test("cookie sessions can read, log in, update passwords and log out when local storage is blocked", async () => {
  const keys = ["window", "document", "localStorage", "fetch"] as const;
  const original = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const calls: Array<{ url: string; options: RequestInit }> = [];
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "" } });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new DOMException("Storage disabled", "SecurityError"); } });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return Response.json({ success: true, token: "cookie-session", user: { id: 1 } });
    } });
    expect((await authApi.me()).success).toBe(true);
    expect((await authApi.login({ username: "cookie_user", password: "password123" })).success).toBe(true);
    expect((await userApi.updateProfile({ oldPassword: "password123", newPassword: "changed123" })).success).toBe(true);
    expect((await authApi.logout()).success).toBe(true);
    expect(calls.map(call => call.url)).toEqual(["/api/auth/me", "/api/auth/login", "/api/user/profile", "/api/auth/logout"]);
    expect(calls.every(call => call.options.credentials === "include")).toBe(true);
    expect(calls.every(call => !(call.options.headers as any).Authorization)).toBe(true);
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("blocked preferences work for the current page without leaking into SSR", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    const browser = { get localStorage() { throw new DOMException("Blocked", "SecurityError"); } };
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
    expect(browserStorage.getItem("audit-theme")).toBeNull();
    browserStorage.setItem("audit-theme", "dark");
    expect(browserStorage.getItem("audit-theme")).toBe("dark");
    Reflect.deleteProperty(globalThis, "window");
    expect(browserStorage.getItem("audit-theme")).toBeNull();
    browserStorage.setItem("audit-theme", "light");
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
    expect(browserStorage.getItem("audit-theme")).toBe("dark");
    browserStorage.removeItem("audit-theme");
    expect(browserStorage.getItem("audit-theme")).toBeNull();
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window");
  }
});
