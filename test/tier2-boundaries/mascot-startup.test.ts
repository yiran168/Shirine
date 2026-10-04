import { afterEach, expect, test } from "bun:test";
import { readMascotVisibility, saveMascotVisibility, isMascotEnabled } from "../../client/src/utils/mascot-visibility";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
function visit(width = 390) {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    innerWidth: width,
    localStorage: { getItem: () => "false" }, // Legacy permanent hide must not suppress new visits.
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } });
}

test("mascot defaults visible on mobile and desktop despite an old permanent hide preference", () => {
  for (const width of [390, 1280]) {
    visit(width);
    expect(readMascotVisibility("guest")).toBe(true);
    expect(readMascotVisibility("admin")).toBe(true);
  }
});

test("dismissal lasts for the current tab visit and is isolated between front and admin", () => {
  visit();
  saveMascotVisibility("guest", false);
  expect(readMascotVisibility("guest")).toBe(false);
  expect(readMascotVisibility("admin")).toBe(true);
  saveMascotVisibility("guest", true);
  expect(readMascotVisibility("guest")).toBe(true);
  saveMascotVisibility("admin", false);
  expect(readMascotVisibility("guest")).toBe(true);
  visit();
  expect(readMascotVisibility("admin")).toBe(true);
});

test("unavailable browser storage does not hide or break the mascot", () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get sessionStorage() { throw new Error("Storage blocked"); },
  } });
  expect(readMascotVisibility("guest")).toBe(true);
  expect(() => saveMascotVisibility("guest", false)).not.toThrow();
});

test("server bootstrap respects independent admin and front-end enable switches", () => {
  expect(isMascotEnabled(null, "guest")).toBe(false);
  expect(isMascotEnabled({}, "guest")).toBe(true);
  const config = { live2dGuestEnabled: false, live2dAdminEnabled: true };
  expect(isMascotEnabled(config, "guest")).toBe(false);
  expect(isMascotEnabled(config, "admin")).toBe(true);
});
