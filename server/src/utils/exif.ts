/**
 * Pure JavaScript EXIF metadata stripper for JPEG, PNG, and WebP images.
 * Runs in Cloudflare Workers with zero native C dependencies.
 * Strips GPS coordinates, device information, camera serial numbers, and timestamps.
 */

export function stripExifFromBuffer(buffer: ArrayBuffer, mime: string): ArrayBuffer {
  try {
    const bytes = new Uint8Array(buffer);

    if (mime === "image/jpeg" || mime === "image/jpg") {
      // JPEG: Verify SOI marker (0xFF, 0xD8)
      if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return buffer;
      }
      const chunks: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
      let offset = 2;
      let stripped = false;

      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          // Stream desynchronized or corrupt, return original buffer
          break;
        }
        const marker = bytes[offset + 1];

        // EOI marker (0xD9): End of Image
        if (marker === 0xd9) {
          chunks.push(bytes.subarray(offset, offset + 2));
          break;
        }

        // Standalone markers without length: RST0-RST7 (0xD0-0xD7), TEM (0x01)
        if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          chunks.push(bytes.subarray(offset, offset + 2));
          offset += 2;
          continue;
        }

        // SOS marker (0xDA): Start of Scan - entropy-coded image data follows to EOI
        if (marker === 0xda) {
          chunks.push(bytes.subarray(offset));
          break;
        }

        if (offset + 4 > bytes.length) break;
        const segmentLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (segmentLen < 2 || offset + 2 + segmentLen > bytes.length) break;

        // Strip APP1 (0xE1 - EXIF metadata) and COM (0xFE - comments)
        if (marker === 0xe1 || marker === 0xfe) {
          stripped = true;
        } else {
          chunks.push(bytes.subarray(offset, offset + 2 + segmentLen));
        }
        offset += 2 + segmentLen;
      }

      if (stripped) {
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result.buffer;
      }
      return buffer;
    }

    if (mime === "image/png") {
      // PNG: Verify 8-byte signature: 89 50 4E 47 0D 0A 1A 0A
      if (
        bytes.length < 8 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47 ||
        bytes[4] !== 0x0d ||
        bytes[5] !== 0x0a ||
        bytes[6] !== 0x1a ||
        bytes[7] !== 0x0a
      ) {
        return buffer;
      }

      const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
      let offset = 8;
      let stripped = false;

      while (offset + 8 <= bytes.length) {
        const dataLen =
          ((bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]) >>>
          0;
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        const chunkTotalLen = 12 + dataLen; // 4 len + 4 type + data + 4 crc

        if (offset + chunkTotalLen > bytes.length) break;

        // Strip eXIf (EXIF), and textual metadata (tEXt, zTXt, iTXt)
        if (type === "eXIf" || type === "tEXt" || type === "zTXt" || type === "iTXt") {
          stripped = true;
        } else {
          chunks.push(bytes.subarray(offset, offset + chunkTotalLen));
        }

        offset += chunkTotalLen;
        if (type === "IEND") break;
      }

      if (stripped) {
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result.buffer;
      }
      return buffer;
    }

    if (mime === "image/webp") {
      // WebP (RIFF container)
      if (bytes.length < 12) return buffer;
      const riff = String.fromCharCode(...bytes.subarray(0, 4));
      const webp = String.fromCharCode(...bytes.subarray(8, 12));
      if (riff !== "RIFF" || webp !== "WEBP") return buffer;

      const chunks: Uint8Array[] = [];
      let offset = 12;
      let stripped = false;

      while (offset + 8 <= bytes.length) {
        const fourcc = String.fromCharCode(...bytes.subarray(offset, offset + 4));
        const chunkLen =
          (bytes[offset + 4] |
            (bytes[offset + 5] << 8) |
            (bytes[offset + 6] << 16) |
            (bytes[offset + 7] << 24)) >>>
          0;
        const paddedLen = chunkLen + (chunkLen % 2); // WebP chunks are 2-byte aligned
        const chunkTotalLen = 8 + paddedLen;

        if (offset + chunkTotalLen > bytes.length) break;

        if (fourcc === "EXIF" || fourcc === "Exif" || fourcc === "XMP " || fourcc === "XMP") {
          stripped = true;
        } else if (fourcc === "VP8X" && chunkTotalLen >= 18) {
          // VP8X header chunk: 8 bytes header + 10 bytes payload
          // Byte 8 is flags. Clear bit 3 (0x08: EXIF) and bit 2 (0x04: XMP) per WebP spec
          const vp8xChunk = new Uint8Array(bytes.subarray(offset, offset + chunkTotalLen));
          vp8xChunk[8] &= ~0x0c;
          chunks.push(vp8xChunk);
        } else {
          chunks.push(bytes.subarray(offset, offset + chunkTotalLen));
        }
        offset += chunkTotalLen;
      }

      if (stripped) {
        const payloadLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const totalFileSize = 4 + payloadLen; // "WEBP" (4) + chunks
        const result = new Uint8Array(8 + totalFileSize);
        // "RIFF"
        result.set([0x52, 0x49, 0x46, 0x46], 0);
        // Little-endian file size
        result[4] = totalFileSize & 0xff;
        result[5] = (totalFileSize >> 8) & 0xff;
        result[6] = (totalFileSize >> 16) & 0xff;
        result[7] = (totalFileSize >> 24) & 0xff;
        // "WEBP"
        result.set([0x57, 0x45, 0x42, 0x50], 8);

        let pos = 12;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result.buffer;
      }
      return buffer;
    }

    return buffer;
  } catch {
    return buffer;
  }
}
