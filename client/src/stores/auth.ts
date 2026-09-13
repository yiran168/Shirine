/**
 * Shirine Client State Management
 */
import { authApi } from "../services/api";

export interface UserState {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  role: "superadmin" | "user";
  points: number;
  checkinStreak: number;
  lastCheckinDate?: string;
  checkedInToday?: boolean;
}

class StoreManager {
  user: UserState | null = null;
  authModalOpen = false;
  authModalTab: "login" | "register" = "login";
  userDrawerOpen = false;
  listeners: Set<() => void> = new Set();

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
    try {
      const res = await authApi.me();
      if (res.success && res.user) {
        this.user = res.user;
        this.notify();
      }
    } catch {}
  }

  setUser(user: UserState | null) {
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
    await authApi.logout();
    this.user = null;
    this.userDrawerOpen = false;
    this.notify();
  }
}

export const authStore = new StoreManager();
if (typeof window !== "undefined") {
  authStore.init();
}
