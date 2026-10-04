import type { PublicSystemConfig } from "./system-config";

export type MascotMode = "guest" | "admin";

export function isMascotEnabled(config: PublicSystemConfig | null, mode: MascotMode): boolean {
  return !!config && (mode === "admin" ? config.live2dAdminEnabled : config.live2dGuestEnabled) !== false;
}

// A dismiss applies to this tab's visit, not every future visit or the other surface.
export function readMascotVisibility(mode: MascotMode): boolean {
  try { return window.sessionStorage.getItem(`shirine_mascot_visible_${mode}`) !== "false"; }
  catch { return true; }
}

export function saveMascotVisibility(mode: MascotMode, visible: boolean): void {
  try { window.sessionStorage.setItem(`shirine_mascot_visible_${mode}`, String(visible)); }
  catch { /* The mounted component still keeps the user's current choice. */ }
}
