import type { ExternalImageService } from "astro";

// Assets are already prepared in the project. Serve them directly rather than
// sending unchanged bytes through the SSR image transformer on every request.
const service: ExternalImageService = {
  getURL(options) {
    return typeof options.src === "string" ? options.src : options.src.src;
  },
  getHTMLAttributes(options) {
    const { src, format, quality, fit, position, ...attributes } = options;
    return attributes;
  },
};
export default service;
