export interface TurnstileClient {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
let pending: Promise<TurnstileClient> | null = null;
export function loadTurnstile(): Promise<TurnstileClient> {
  const current = (window as any).turnstile as TurnstileClient | undefined;
  if (current) return Promise.resolve(current);
  if (pending) return pending;
  pending = new Promise<TurnstileClient>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => fail(), 15000);
    const fail = () => { clearTimeout(timeout); script.remove(); pending = null; reject(new Error("人机验证加载失败，请检查网络后重试")); };
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => { clearTimeout(timeout); const api = (window as any).turnstile; if (api) resolve(api); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
