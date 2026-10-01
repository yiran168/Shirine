/** Deduplicate a render's data reads without sharing permissions across requests. */
export function createRequestCache() {
  let requests = new WeakMap<Request, Map<string, Promise<unknown>>>();
  return {
    clear() { requests = new WeakMap(); },
    get<T>(request: Request | undefined, key: string, read: () => Promise<T>): Promise<T> {
      if (!request) return read();
      let entries = requests.get(request);
      if (!entries) { entries = new Map(); requests.set(request, entries); }
      const existing = entries.get(key);
      if (existing) return existing as Promise<T>;
      const pending = read();
      entries.set(key, pending);
      pending.catch(() => { if (entries!.get(key) === pending) entries!.delete(key); });
      return pending;
    },
  };
}
