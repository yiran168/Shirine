import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";

export const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function buf2hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// POST /api/upload (Upload image/file to R2)
uploadRouter.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!file) {
      return c.json({ success: false, error: "No file provided" }, 400);
    }

    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-1", fileBuffer);
    const hash = buf2hex(hashBuffer);

    const originalName = file.name || "upload.png";
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "webp";
    const key = `uploads/${hash}.${ext}`;

    // If R2 bucket is bound
    if (c.env.STORAGE) {
      await c.env.STORAGE.put(key, fileBuffer, {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
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
        type: file.type,
      });
    } else {
      // Local development fallback if R2 is not locally configured:
      // Return a base64 Data URL or local placeholder
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      const dataUrl = `data:${file.type || "image/png"};base64,${base64}`;

      return c.json({
        success: true,
        url: dataUrl,
        key,
        note: "R2 binding not detected, returned data URI for local preview.",
      });
    }
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ success: false, error: err.message || "Failed to upload file" }, 500);
  }
});

// GET /api/blob/:key (Stream file from R2)
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

    return new Response(object.body, { headers });
  } catch (err: any) {
    return c.text("Error fetching file", 500);
  }
});
