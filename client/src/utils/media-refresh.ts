// Refresh expired signed image URLs once per image on long-open pages.
const retried = new WeakSet<HTMLImageElement>();
document.addEventListener("error", async (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || retried.has(image)) return;
  const url = new URL(image.currentSrc || image.src, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/blob/") || !url.searchParams.has("signature")) return;
  retried.add(image);
  try {
    const response = await fetch(`/api/media/refresh?url=${encodeURIComponent(url.pathname + url.search)}`, { method: "POST", credentials: "same-origin" });
    const data = await response.json();
    if (data.success && typeof data.url === "string") { image.srcset = ""; image.src = data.url; }
  } catch { /* Keep the original error state; do not loop on inaccessible media. */ }
}, true);
