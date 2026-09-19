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

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      let userFriendlyError = "服务器返回了非预期响应";
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        if (res.status === 404) {
          userFriendlyError = "后端 API 端点不存在 (404)，请检查 Worker 部署或 PUBLIC_API_URL 配置";
        } else {
          userFriendlyError = `后端返回了 HTML 页面而非 JSON 数据 (${res.status})，请检查 PUBLIC_API_URL 环境变量配置`;
        }
      } else if (res.status === 404) {
        userFriendlyError = "后端 API 端点不存在 (404)，请检查 Worker 部署或 PUBLIC_API_URL 配置";
      } else if (res.status === 502 || res.status === 503) {
        userFriendlyError = `无法连接到后端服务 (${res.status})，请检查后端 Worker 状态及 PUBLIC_API_URL 环境变量`;
      } else if (text.includes("Worker exceeded resource limits") || res.status === 1102) {
        userFriendlyError = "Cloudflare Worker 资源超限 (Error 1102)，请稍后重试";
      } else if (!res.ok) {
        userFriendlyError = `服务器响应异常 (${res.status} ${res.statusText || ""})`.trim();
      }
      return {
        success: false,
        error: userFriendlyError,
        raw: text.slice(0, 300),
      };
    }

    if (!res.ok && data && typeof data === "object") {
      return {
        success: false,
        error: data.error || data.message || `请求失败 (${res.status})`,
        ...data,
      };
    }

    return data;
  } catch (err: any) {
    console.error(`API Error [${endpoint}]:`, err);
    return { success: false, error: err.message || "网络请求失败，请检查网络连接" };
  }
}

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------
export const authApi = {
  getSetupStatus: () => request<{ needsSetup: boolean }>("/auth/setup/status", { method: "GET" }),
  setupAdmin: async (body: { username: string; password: string; nickname?: string; setupToken?: string }) => {
    const res = await request("/auth/setup/admin", { method: "POST", body: JSON.stringify(body) });
    if (res.success && res.token) {
      setToken(res.token);
    }
    return res;
  },
  register: async (body: { username: string; password: string; email?: string; nickname?: string; turnstileToken?: string }) => {
    const res = await request("/auth/register", { method: "POST", body: JSON.stringify(body) });
    if (res.success && res.token) {
      setToken(res.token);
    }
    return res;
  },
  login: async (body: { username: string; password: string; turnstileToken?: string }) => {
    const res = await request("/auth/login", { method: "POST", body: JSON.stringify(body) });
    if (res.success && res.token) {
      setToken(res.token);
    }
    return res;
  },
  me: () => request("/auth/me", { method: "GET" }),
  logout: async () => {
    try {
      return await request("/auth/logout", { method: "POST" });
    } finally {
      removeToken();
    }
  },
  logoutAll: async () => {
    try {
      return await request("/auth/logout-all", { method: "POST" });
    } finally {
      removeToken();
    }
  },
};

// -------------------------------------------------------------
// User & Check-in API
// -------------------------------------------------------------
export const userApi = {
  checkin: () => request("/user/checkin", { method: "POST" }),
  getHistory: () => request("/user/history", { method: "GET" }),
  updateProfile: async (body: { nickname?: string; avatar?: string; newPassword?: string; oldPassword?: string }) => {
    const res = await request("/user/profile", { method: "PUT", body: JSON.stringify(body) });
    if (res.success && res.token) {
      setToken(res.token);
    }
    return res;
  },
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
  verifyPassword: (id: number, password: string) =>
    request(`/posts/${id}/password/verify`, { method: "POST", body: JSON.stringify({ password }) }),
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

    const text = await res.text();
    try {
      return text ? JSON.parse(text) : { success: false, error: "Empty response" };
    } catch {
      return { success: false, error: `上传失败 (HTTP ${res.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}
