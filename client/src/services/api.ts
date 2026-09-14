/**
 * Shirine Client API Service
 * Centralized API client for communicating with Cloudflare Workers backend.
 */

const API_BASE =
  typeof window !== "undefined"
    ? (window as any).__SHIRINE_API_URL__ ||
      import.meta.env.PUBLIC_API_URL ||
      (window.location.port === "4321" ? "http://localhost:11498/api" : "/api")
    : import.meta.env.PUBLIC_API_URL || "http://localhost:11498/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("shirine_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("shirine_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("shirine_token");
  }
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const url = `${API_BASE.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error(`API Error [${endpoint}]:`, err);
    return { success: false, error: err.message || "Network error" };
  }
}

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------
export const authApi = {
  register: (body: { username: string; password: string; nickname?: string; turnstileToken?: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { username: string; password: string; turnstileToken?: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me", { method: "GET" }),
  logout: () => {
    removeToken();
    return request("/auth/logout", { method: "POST" });
  },
};

// -------------------------------------------------------------
// User & Check-in API
// -------------------------------------------------------------
export const userApi = {
  checkin: () => request("/user/checkin", { method: "POST" }),
  getHistory: () => request("/user/history", { method: "GET" }),
  updateProfile: (body: { nickname?: string; avatar?: string; newPassword?: string; oldPassword?: string }) =>
    request("/user/profile", { method: "PUT", body: JSON.stringify(body) }),
};

// -------------------------------------------------------------
// Posts API
// -------------------------------------------------------------
export const postsApi = {
  list: (params?: { page?: number; pageSize?: number; category?: string; tag?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.category) query.set("category", params.category);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.search) query.set("search", params.search);
    return request(`/posts?${query.toString()}`);
  },
  get: (slugOrId: string | number) => request(`/posts/${slugOrId}`),
  unlock: (id: number) => request(`/posts/${id}/unlock`, { method: "POST" }),
  create: (body: any) => request("/posts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: any) => request(`/posts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/posts/${id}`, { method: "DELETE" }),
};

// -------------------------------------------------------------
// Albums API
// -------------------------------------------------------------
export const albumsApi = {
  list: () => request("/albums"),
  get: (id: number) => request(`/albums/${id}`),
  unlock: (id: number) => request(`/albums/${id}/unlock`, { method: "POST" }),
  create: (body: any) => request("/albums", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: any) => request(`/albums/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/albums/${id}`, { method: "DELETE" }),
  addPhoto: (albumId: number, body: { url: string; title?: string; description?: string; sortOrder?: number }) =>
    request(`/albums/${albumId}/photos`, { method: "POST", body: JSON.stringify(body) }),
  deletePhoto: (photoId: number) => request(`/albums/photos/${photoId}`, { method: "DELETE" }),
};

// -------------------------------------------------------------
// Moments API
// -------------------------------------------------------------
export const momentsApi = {
  list: () => request("/moments"),
  create: (body: any) => request("/moments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: any) => request(`/moments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/moments/${id}`, { method: "DELETE" }),
};

// -------------------------------------------------------------
// Custom Pages API
// -------------------------------------------------------------
export const pagesApi = {
  list: () => request("/pages"),
  get: (slug: string) => request(`/pages/${slug}`),
  create: (body: any) => request("/pages", { method: "POST", body: JSON.stringify(body) }),
  update: (slug: string, body: any) => request(`/pages/${slug}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/pages/${id}`, { method: "DELETE" }),
};

// -------------------------------------------------------------
// Friends API
// -------------------------------------------------------------
export const friendsApi = {
  list: () => request("/friends"),
  apply: (body: { name: string; avatar: string; url: string; desc?: string }) =>
    request("/friends/apply", { method: "POST", body: JSON.stringify(body) }),
  create: (body: any) => request("/friends", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: any) => request(`/friends/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: number) => request(`/friends/${id}`, { method: "DELETE" }),
};

// -------------------------------------------------------------
// Configs API
// -------------------------------------------------------------
export const configApi = {
  getSite: () => request("/config/site"),
  updateSite: (body: any) => request("/config/site", { method: "PUT", body: JSON.stringify(body) }),
  getSystem: () => request("/config/system"),
  getAdminSystem: () => request("/config/system/admin"),
  updateSystem: (body: any) => request("/config/system", { method: "PUT", body: JSON.stringify(body) }),
};

// -------------------------------------------------------------
// Admin Management API
// -------------------------------------------------------------
export const adminApi = {
  getStats: () => request("/admin/stats"),
  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.search) query.set("search", params.search);
    return request(`/admin/users?${query.toString()}`);
  },
  updateUserPoints: (id: number, body: { exactPoints?: number; delta?: number }) =>
    request(`/admin/users/${id}/points`, { method: "PUT", body: JSON.stringify(body) }),
  updateUserRole: (id: number, role: "superadmin" | "admin" | "user") =>
    request(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  updateUserStatus: (id: number, status: "active" | "banned") =>
    request(`/admin/users/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  seedPresets: (overwrite = false) =>
    request("/admin/seed", { method: "POST", body: JSON.stringify({ overwrite }) }),
};

// -------------------------------------------------------------
// Upload API (R2)
// -------------------------------------------------------------
export async function uploadFile(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE.replace(/\/$/, "")}/upload`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}
