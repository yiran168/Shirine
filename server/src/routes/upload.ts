import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";

export const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit (#128)

function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// POST /api/upload (Upload image to R2 with MIME & size validation #128, #129, #130)
uploadRouter.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!file) {
      return c.json({ success: false, error: "No file provided" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ success: false, error: "File size exceeds the 10MB limit" }, 400);
    }

    const mime = file.type?.toLowerCase() || "";
    const safeExt = ALLOWED_MIME_TYPES[mime];
    if (!safeExt) {
      return c.json(
        {
          success: false,
          error: `Unsupported file format (${mime || "unknown"}). Only images (JPEG, PNG, WebP, GIF, AVIF, SVG) are allowed.`,
        },
        400
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-1", fileBuffer);
    const hash = buf2hex(hashBuffer);
    const key = `uploads/${hash}.${safeExt}`;

    if (c.env.STORAGE) {
      await c.env.STORAGE.put(key, fileBuffer, {
        httpMetadata: {
          contentType: mime,
        },
      });

      const publicUrl = c.env.PUBLIC_R2_URL
        ? `${c.env.PUBLIC_R2_URL.replace(/\/$/, "")}/${key}`
        : `/api/blob/${encodeURIComponent(key)}`;

      return c.json({
        success: true,
        url: publicUrl,
        key,
        size: file.size,
        type: mime,
      });
    } else {
      // Safe base64 encoding without spreading large array into function arguments (#133)
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, len)));
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${mime};base64,${base64}`;

      return c.json({
        success: true,
        url: dataUrl,
        key,
        size: file.size,
        type: mime,
        note: "R2 binding not detected, returned preview data URI.",
      });
    }
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ success: false, error: err.message || "Failed to upload file" }, 500);
  }
});

// GET /api/blob/* (Stream file from R2 with X-Content-Type-Options #132)
uploadRouter.get("/blob/*", async (c) => {
  try {
    const key = c.req.path.replace(/^\/blob\/?/, "").replace(/^\/api\/blob\/?/, "");
    if (!key) {
      return c.text("Key is required", 400);
    }

    if (!c.env.STORAGE) {
      return c.text("Storage bucket not bound", 404);
    }

    const object = await c.env.STORAGE.get(decodeURIComponent(key));
    if (!object) {
      return c.text("Object not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff"); // Security header (#132)

    return new Response(object.body, { headers });
  } catch (err: any) {
    return c.text("Error fetching file", 500);
  }
});
