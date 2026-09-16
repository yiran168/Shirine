import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";

import { getDb, schema } from "../db";
import { and, eq, like } from "drizzle-orm";

export const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit (#128)

function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function validateImageMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
  if (buffer.byteLength < 12) return false;
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mime === "image/gif") {
    return (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    );
  }
  if (mime === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  if (mime === "image/avif") {
    return (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    );
  }
  return false;
}

// POST /api/upload (Upload image to R2 with MIME, magic-byte & size validation)
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
          error: `Unsupported file format (${mime || "unknown"}). Only bitmap images (JPEG, PNG, WebP, GIF, AVIF) are allowed. SVG uploads are strictly prohibited for security.`,
        },
        400
      );
    }

    const fileBuffer = await file.arrayBuffer();
    if (!validateImageMagicBytes(fileBuffer, mime)) {
      return c.json(
        {
          success: false,
          error: "File content signature does not match declared image MIME type",
        },
        400
      );
    }

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

    const decodedKey = decodeURIComponent(key);
    const object = await c.env.STORAGE.get(decodedKey);
    if (!object) {
      return c.text("Object not found", 404);
    }

    let isProtected = false;
    if (c.env.DB) {
      try {
        const db = getDb(c.env.DB);
        const photoMatch = await db.query.albumPhotos.findFirst({
          where: like(schema.albumPhotos.url, `%${decodedKey}%`),
        });
        if (photoMatch) {
          const album = await db.query.albums.findFirst({
            where: eq(schema.albums.id, photoMatch.albumId),
          });
          if (album && (album.draft === 1 || album.permissionType !== "public")) {
            isProtected = true;
            const user = c.get("user");
            const isAdmin = user && (user.role === "superadmin" || user.role === "admin");
            const isAuthor = user && album.uid && user.id === album.uid;
            if (!isAdmin && !isAuthor) {
              if (!user) {
                return c.text("Unauthorized: Authentication required to access protected media", 401);
              }
              if (album.draft === 1) {
                return c.text("Forbidden: Draft album media is unpublished", 403);
              }
              if (album.permissionType === "points_required") {
                const unlock = await db.query.albumUnlocks.findFirst({
                  where: and(
                    eq(schema.albumUnlocks.userId, user.id),
                    eq(schema.albumUnlocks.albumId, album.id)
                  ),
                });
                if (!unlock) {
                  return c.text("Forbidden: Album must be unlocked before accessing media", 403);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Blob authorization check failed:", err);
      }
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");

    const contentType = headers.get("content-type") || "";
    if (contentType.includes("svg") || contentType.includes("html") || contentType.includes("xml")) {
      headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
      headers.set("Content-Disposition", "attachment");
    }

    if (isProtected) {
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    } else {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    return new Response(object.body, { headers });
  } catch (err: any) {
    return c.text("Error fetching file", 500);
  }
});
