import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Astro SSR API Proxy Handler (V10-P0-18).
 * Solves the Pages frontend vs Workers API domain separation dilemma:
 * Relative requests like <img src="/api/blob/key"> or client fetch("/api/...")
 * made to the frontend domain are transparently forwarded to the Workers backend.
 */
export const ALL: APIRoute = async ({ request, params, locals }) => {
  const runtimeEnv = (locals as any)?.runtime?.env || {};
  const configuredBase = (
    runtimeEnv.PUBLIC_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    (import.meta.env.PROD ? "" : "http://localhost:11498/api")
  ).replace(/\/+$/, "");

  const cleanPath = (params.path || "").replace(/^\/+|\/+$/g, "");
  const incomingUrl = new URL(request.url);

  let bodyBuffer: ArrayBuffer | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      bodyBuffer = await request.clone().arrayBuffer();
    } catch {
      try {
        bodyBuffer = await request.arrayBuffer();
      } catch {
        // Body may already be read or not available
      }
    }
  }

  // 1. Service Binding proxy fallback on Cloudflare Pages
  const serviceBinding = runtimeEnv.SHIRINE_SERVER || runtimeEnv.BACKEND || runtimeEnv.API;
  if (!configuredBase && serviceBinding && typeof serviceBinding.fetch === "function") {
    const targetUrl = cleanPath
      ? `https://shirine-internal/api/${cleanPath}${incomingUrl.search}`
      : `https://shirine-internal/api${incomingUrl.search}`;
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete("host");

    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      redirect: "manual",
    };
    if (bodyBuffer) {
      init.body = bodyBuffer;
      // @ts-ignore Node/Cloudflare duplex streaming support
      init.duplex = "half";
    }

    try {
      const upstreamRes = await serviceBinding.fetch(targetUrl, init);
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: new Headers(upstreamRes.headers),
      });
    } catch (bindErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cloudflare Pages 无法通过服务绑定连接到 Shirine 后端 Worker",
          detail: bindErr.message,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!configuredBase) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "后端 API 地址未配置。请在 Cloudflare Pages 控制台设置 PUBLIC_API_URL 环境变量 (例如: https://shirine-server.<subdomain>.workers.dev/api) 或绑定 SHIRINE_SERVER 服务。",
        code: "MISSING_PUBLIC_API_URL",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 2. HTTP proxy forwarding
  const apiBase = configuredBase.endsWith("/api") ? configuredBase : `${configuredBase}/api`;
  const targetUrl = cleanPath
    ? `${apiBase}/${cleanPath}${incomingUrl.search}`
    : `${apiBase}${incomingUrl.search}`;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
  };

  if (bodyBuffer) {
    init.body = bodyBuffer;
    // @ts-ignore Node/Cloudflare duplex streaming support
    init.duplex = "half";
  }

  try {
    const upstreamRes = await fetch(targetUrl, init);
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: new Headers(upstreamRes.headers),
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "无法连接到 Shirine 后端 API 代理端点",
        detail: err.message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
