import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Astro SSR API Proxy Handler (V10-P0-18).
 * Solves the Pages frontend vs Workers API domain separation dilemma:
 * Relative requests like <img src="/api/blob/key"> or client fetch("/api/...")
 * made to the frontend domain are transparently forwarded to the Workers backend.
 */
export const ALL: APIRoute = async ({ request, params }) => {
  const rawBase = (
    import.meta.env.PUBLIC_API_URL || "http://localhost:11498/api"
  ).replace(/\/$/, "");
  const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

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
