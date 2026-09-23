import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";
import { stripExifFromBuffer } from "../utils/exif";
import { handleBlobStream } from "../core/blob-handler";

export const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit (#128)
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB limit for music/audio

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

function validateAudioMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (mime.includes("flac")) {
    return bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43;
  }
  if (mime.includes("ogg")) {
    return bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  if (mime.includes("wav")) {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  }
  if (mime.includes("mp3") || mime.includes("mpeg")) {
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // ID3
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true; // MPEG frame sync
    return true;
  }
  if (mime.includes("m4a") || mime.includes("mp4") || mime.includes("aac")) {
    if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return true; // ftyp
    }
    return true;
  }
  return true;
}

// GET /api/upload (List files in R2 storage for Media Library)
uploadRouter.get("/", requireAdmin, async (c) => {
  if (!c.env.STORAGE) {
    return c.json({ success: true, objects: [] });
  }
  try {
    const listed = await c.env.STORAGE.list({ limit: 100 });
    const publicUrlBase = c.env.PUBLIC_R2_URL?.replace(/\/$/, "") || "";
    const objects = listed.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
      httpMetadata: obj.httpMetadata,
      url: publicUrlBase ? `${publicUrlBase}/${obj.key}` : `/api/blob/${encodeURIComponent(obj.key)}`,
    }));
    return c.json({ success: true, objects });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to list media" }, 500);
  }
});

// DELETE /api/upload/:key{.+$} (Delete file from R2)
uploadRouter.delete("/:key{.+$}", requireAdmin, async (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.json({ success: false, error: "Key is required" }, 400);
  }
  if (!c.env.STORAGE) {
    return c.json({ success: true, message: "Storage not configured" });
  }
  try {
    await c.env.STORAGE.delete(key);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to delete file" }, 500);
  }
});

// POST /api/upload (Upload image/audio to R2 with MIME, magic-byte & size validation)
uploadRouter.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!file) {
      return c.json({ success: false, error: "No file provided" }, 400);
    }

    const mime = file.type?.toLowerCase() || "";
    const isAudio = mime.startsWith("audio/");
    const safeExt = ALLOWED_MIME_TYPES[mime];
    if (!safeExt) {
      return c.json(
        {
          success: false,
          error: `Unsupported file format (${mime || "unknown"}). Allowed formats: JPEG, PNG, WebP, GIF, AVIF, MP3, FLAC, WAV, OGG, M4A, AAC. SVG uploads are strictly prohibited for security.`,
        },
        400
      );
    }

    const maxSize = isAudio ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return c.json({ success: false, error: `File size exceeds the ${isAudio ? "50MB" : "10MB"} limit` }, 400);
    }

    const rawBuffer = await file.arrayBuffer();
    if (isAudio) {
      if (!validateAudioMagicBytes(rawBuffer, mime)) {
        return c.json(
          {
            success: false,
            error: "File content signature does not match declared audio MIME type",
          },
          400
        );
      }
    } else {
      if (!validateImageMagicBytes(rawBuffer, mime)) {
        return c.json(
          {
            success: false,
            error: "File content signature does not match declared image MIME type",
          },
          400
        );
      }
    }

    // Strip EXIF metadata to protect user privacy (GPS, camera info, serial numbers) for images only
    const fileBuffer = isAudio ? rawBuffer : stripExifFromBuffer(rawBuffer, mime);

    const hashBuffer = await crypto.subtle.digest("SHA-1", fileBuffer);
    const hash = buf2hex(hashBuffer);
    const entropy = crypto.randomUUID().slice(0, 8);
    const prefix = isAudio ? "audio" : "uploads";
    const key = `${prefix}/${hash}-${entropy}.${safeExt}`;

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
        size: fileBuffer.byteLength,
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
        size: fileBuffer.byteLength,
        type: mime,
        note: "R2 binding not detected, returned preview data URI.",
      });
    }
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ success: false, error: err.message || "Failed to upload file" }, 500);
  }
});

// GET /api/upload/blob/* (Stream file from R2 using secure ACL check)
uploadRouter.get("/blob/*", async (c) => {
  return handleBlobStream(c);
});
