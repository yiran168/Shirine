/**
 * Cloudflare R2 and Asset URL Utilities
 * Strictly enforces URL cleanliness, scheme security, and normalization.
 */

/**
 * Sanitizes and normalizes a Cloudflare R2 public / custom CDN domain.
 * - Trims whitespace
 * - Strips trailing slashes
 * - Rejects dangerous schemes (javascript:, data:, vbscript:, file:, blob:, mailto:, tel:)
 * - Rejects relative paths and hash-only strings
 * - Auto-prepends https:// if domain-like without scheme (e.g. assets.example.com)
 * - Returns empty string if invalid
 */
export function sanitizeR2Url(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";
  let trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return "";
  if (trimmed.includes(":") && !/^https?:\/\//i.test(trimmed)) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}
