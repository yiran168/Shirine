import { defineMiddleware } from "astro:middleware";
import { setSiteLang } from "./i18n/translation";
import { getDynamicSiteConfig } from "./utils/dynamic-config";

export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeEnv = (context.locals as any)?.runtime?.env;
  if (runtimeEnv) {
    const binding = runtimeEnv.SHIRINE_SERVER || runtimeEnv.BACKEND || runtimeEnv.API;
    if (binding && typeof binding.fetch === "function") {
      (globalThis as any).__SHIRINE_SERVICE_BINDING__ = binding;
    }
    if (runtimeEnv.PUBLIC_API_URL && !import.meta.env.PUBLIC_API_URL) {
      (globalThis as any).__SHIRINE_RUNTIME_API_URL__ = runtimeEnv.PUBLIC_API_URL;
    }
  }

  // API/media requests must not wait for a site-config round trip.
  if (context.url.pathname.startsWith("/api/")) return next();

  const cookieLang = context.cookies.get("shirine_lang")?.value;
  const queryLang = context.url.searchParams.get("lang");
  let lang = queryLang || cookieLang;
  try {
    const { site } = await getDynamicSiteConfig(context.request);
    if (!lang) {
      lang = site?.lang || "zh_CN";
    }
  } catch {
    if (!lang) lang = "zh_CN";
  }

  if (queryLang && queryLang !== cookieLang) {
    try {
      context.cookies.set("shirine_lang", queryLang, {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
    } catch {}
  }

  setSiteLang(lang);
  context.locals.lang = lang;
  const response = await next();
  if (response.headers.get("Content-Type")?.includes("text/html")) {
    // HTML embeds permission state and can change immediately after publishing
    // or unlocking. Static assets retain their independent cache policy.
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.append("Vary", "Cookie");
  }
  return response;
});
