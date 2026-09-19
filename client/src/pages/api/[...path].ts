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
  ).replace(/\/$/, "");

  if (!configuredBase) {
    const serviceBinding = runtimeEnv.BACKEND || runtimeEnv.API || runtimeEnv.SHIRINE_SERVER;
    if (serviceBinding && typeof serviceBinding.fetch === "function") {
      const rawPath = params.path || "";
      const incomingUrl = new URL(request.url);
      const targetUrl = `https://shirine-internal/api/${rawPath}${incomingUrl.search}`;
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.delete("host");
      const init: RequestInit = {
        method: request.method,
        headers: forwardHeaders,
        redirect: "manual",
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
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
            error: "Service binding error forwarding to Shirine backend",
            detail: bindErr.message,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "后端 API 地址未配置。请在 Cloudflare Pages 控制台设置 PUBLIC_API_URL 环境变量 (例如: https://shirine-server.<subdomain>.workers.dev/api)",
        code: "MISSING_PUBLIC_API_URL",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const apiBase = configuredBase.endsWith("/api") ? configuredBase : `${configuredBase}/api`;
  const rawPath = params.path || "";
  const incomingUrl = new URL(request.url);
  const targetUrl = `${apiBase}/${rawPath}${incomingUrl.search}`;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-ignore Node/Cloudflare duplex streaming support
    init.duplex = "half";
  }

  try {
    const upstreamRes = await fetch(targetUrl, init);

    const resHeaders = new Headers(upstreamRes.headers);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to connect to Shirine backend API proxy",
        detail: err.message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
