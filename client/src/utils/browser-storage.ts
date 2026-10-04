// Preferences are optional. Blocked/quota-limited storage must not stop UI startup.
// This fallback only runs in a browser and never stores SSR user preferences.
const fallbackKey = Symbol.for("shirine.browser.preferences");
function fallback() {
  const browser = window as unknown as Record<symbol, Map<string, string | null>>;
  return browser[fallbackKey] ??= new Map<string, string | null>();
}
export const browserStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    const fallbackValues = fallback();
    if (fallbackValues.has(key)) return fallbackValues.get(key)!;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    const fallbackValues = fallback();
    try { window.localStorage.setItem(key, value); fallbackValues.delete(key); }
    catch { fallbackValues.set(key, value); }
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    const fallbackValues = fallback();
    try { window.localStorage.removeItem(key); fallbackValues.delete(key); }
    catch { fallbackValues.set(key, null); }
  },
};
