/**
 * Shirine Client State Management (Svelte 5 Runes)
 */
import { authApi } from "../services/api";

export interface UserState {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  role: "superadmin" | "admin" | "user";
  points: number;
  checkinStreak: number;
  lastCheckinDate?: string;
  checkedInToday?: boolean;
}

class StoreManager {
  user = $state<UserState | null>(null);
  authModalOpen = $state(false);
  authModalTab = $state<"login" | "register">("login");
  userDrawerOpen = $state(false);
  listeners: Set<() => void> = new Set();
  private sessionRevision = 0;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  async init() {
    if (typeof window === "undefined") return;
    const revision = ++this.sessionRevision;
    try {
      const token = localStorage.getItem("shirine_token");
      if (token && !document.cookie.includes("shirine_token=")) {
        document.cookie = `shirine_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      }
    } catch {}
    try {
      const res = await authApi.me();
      if (revision === this.sessionRevision && res.success && res.user) {
        this.user = res.user as UserState;
        this.notify();
      }
    } catch {}
  }

  setUser(user: UserState | null) {
    this.sessionRevision++;
    this.user = user;
    this.notify();
  }

  openAuthModal(tab: "login" | "register" = "login") {
    this.authModalTab = tab;
    this.authModalOpen = true;
    this.notify();
  }

  closeAuthModal() {
    this.authModalOpen = false;
    this.notify();
  }

  openUserDrawer() {
    this.userDrawerOpen = true;
    this.notify();
  }

  closeUserDrawer() {
    this.userDrawerOpen = false;
    this.notify();
  }

  async logout() {
    const res = await authApi.logout();
    if (!res.success) throw new Error(res.error || "退出登录失败，请重试");
    this.sessionRevision++;
    this.user = null;
    this.userDrawerOpen = false;
    this.notify();
    if (typeof window !== "undefined") {
      try {
        (window as any).swup?.cache?.clear?.();
      } catch {}
      window.location.reload();
    }
  }

  async logoutAll() {
    const res = await authApi.logoutAll();
    if (!res.success) throw new Error(res.error || "退出登录失败，请重试");
    this.sessionRevision++;
    this.user = null;
    this.userDrawerOpen = false;
    this.notify();
    if (typeof window !== "undefined") {
      try {
        (window as any).swup?.cache?.clear?.();
      } catch {}
      window.location.reload();
    }
  }
}

export const authStore = new StoreManager();
if (typeof window !== "undefined") {
  authStore.init();
}
