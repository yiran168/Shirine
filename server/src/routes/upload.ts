import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAdmin } from "../core/middleware";
import { stripExifFromBuffer } from "../utils/exif";
import { handleBlobStream } from "../core/blob-handler";
import { getPublicR2Url } from "../core/r2-config";

export const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

export { getPublicR2Url } from "../core/r2-config";

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
    if (String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return false;
    const boxSize = new DataView(buffer).getUint32(0);
    if (boxSize < 16 || boxSize > buffer.byteLength || boxSize > 4096) return false;
    const brands = new Uint8Array(buffer, 8, boxSize - 8);
    for (let i = 0; i + 4 <= brands.length; i += 4) {
      if (i === 4) continue; // minor version, not a compatible brand
      if (["avif", "avis"].includes(String.fromCharCode(...brands.slice(i, i + 4)))) return true;
    }
    return false;
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
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WAVE";
  }
  if (mime.includes("mp3") || mime.includes("mpeg")) {
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // ID3
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true; // MPEG frame sync
    return false;
  }
  if (mime.includes("aac")) {
    return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0; // ADTS sync and layer
  }
  if (mime.includes("m4a") || mime.includes("mp4")) {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  return false;
}

// GET /api/upload (List files in R2 storage for Media Library)
uploadRouter.get("/", requireAdmin, async (c) => {
  if (!c.env.STORAGE) {
    return c.json({ success: false, error: "R2 存储未配置，无法读取媒体库" }, 503);
  }
  try {
    const options: R2ListOptions & { include: ("httpMetadata" | "customMetadata")[] } = {
      limit: 100, cursor: c.req.query("cursor") || undefined, include: ["httpMetadata", "customMetadata"],
    };
    const listed = await c.env.STORAGE.list(options);
    const publicUrlBase = await getPublicR2Url(c.env);
    const objects = listed.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
      httpMetadata: obj.httpMetadata,
      originalName: obj.customMetadata?.originalName || obj.key.split("/").pop() || obj.key,
      url: `${publicUrlBase}/${obj.key.split("/").map(encodeURIComponent).join("/")}`,
    }));
    return c.json({ success: true, objects, cursor: listed.truncated ? listed.cursor : null });
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
    return c.json({ success: false, error: "R2 存储未配置，无法删除文件" }, 503);
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
  if (!c.env.STORAGE) return c.json({ success: false, error: "R2 存储未配置，文件未上传，请先配置存储绑定" }, 503);
  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!(file instanceof File)) {
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

    const originalName = (file.name.split(/[\\/]/).pop() || `file.${safeExt}`).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200);
    const stored = await c.env.STORAGE.put(key, fileBuffer, {
      httpMetadata: { contentType: mime },
      customMetadata: { originalName },
    });
    if (!stored) return c.json({ success: false, error: "文件未能写入 R2，请重试" }, 503);

    const publicUrlBase = await getPublicR2Url(c.env);
    const publicUrl = `${publicUrlBase}/${key}`;

    return c.json({
      success: true,
      url: publicUrl,
      key,
      size: fileBuffer.byteLength,
      type: mime,
      originalName,
      uploaded: stored.uploaded.toISOString(),
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ success: false, error: err.message || "Failed to upload file" }, 500);
  }
});

// GET /api/upload/blob/* (Stream file from R2 using secure ACL check)
uploadRouter.get("/blob/*", async (c) => {
  return handleBlobStream(c);
});
