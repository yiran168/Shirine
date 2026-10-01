import { fetchApi } from "./content-utils";
export interface PublicSystemConfig {
  live2dGuestEnabled?: boolean;
  live2dAdminEnabled?: boolean;
  live2dModel?: string;
  live2dQuotes?: string[] | string;
}
const requests = new WeakMap<Request, Promise<PublicSystemConfig | null>>();
export function getPublicSystemConfig(request: Request): Promise<PublicSystemConfig | null> {
  if (requests.has(request)) return requests.get(request)!;
  const pending = (async () => {
    try {
      const response = await fetchApi("/config/system", request);
      if (!response?.ok) return null;
      const result = await response.json();
      return result.success ? result.data || result.config : null;
    } catch { return null; }
  })();
  requests.set(request, pending);
  return pending;
}
