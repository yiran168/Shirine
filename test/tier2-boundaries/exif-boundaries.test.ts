import { describe, it, expect } from "bun:test";
import { stripExifFromBuffer } from "../../server/src/utils/exif";

describe("Tier 2 - Boundary: EXIF/XMP Stripper Robustness & Edge Cases", () => {
  it("B2.1: Empty buffer is handled safely without crashing", () => {
    const empty = new ArrayBuffer(0);
    const resultJpeg = stripExifFromBuffer(empty, "image/jpeg");
    expect(resultJpeg.byteLength).toBe(0);

    const resultWebp = stripExifFromBuffer(empty, "image/webp");
    expect(resultWebp.byteLength).toBe(0);

    const resultPng = stripExifFromBuffer(empty, "image/png");
    expect(resultPng.byteLength).toBe(0);
  });

  it("B2.2: Corrupt or truncated JPEG header returns original buffer gracefully", () => {
    // Missing SOI (not 0xFF, 0xD8)
    const badJpeg = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = stripExifFromBuffer(badJpeg.buffer, "image/jpeg");
    expect(new Uint8Array(result)).toEqual(badJpeg);

    // Truncated segment length
    const truncatedSegment = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x10]);
    const result2 = stripExifFromBuffer(truncatedSegment.buffer, "image/jpeg");
    expect(result2.byteLength).toBe(5);
  });

  it("B2.3: Non-image and unsupported MIME types pass through untouched", () => {
    const rawData = new TextEncoder().encode("Hello World plaintext");
    const mimeTypes = ["text/plain", "application/pdf", "video/mp4", "application/json"];

    for (const mime of mimeTypes) {
      const result = stripExifFromBuffer(rawData.buffer, mime);
      expect(new TextDecoder().decode(result)).toBe("Hello World plaintext");
    }
  });

  it("B2.4: Truncated WebP header (< 12 bytes) returns original buffer safely", () => {
    const shortWebp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04]); // "RIFF" + 1 byte
    const result = stripExifFromBuffer(shortWebp.buffer, "image/webp");
    expect(new Uint8Array(result)).toEqual(shortWebp);
  });

  it("B2.5: Truncated PNG header (< 8 bytes) returns original buffer safely", () => {
    const shortPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // Only 4 bytes
    const result = stripExifFromBuffer(shortPng.buffer, "image/png");
    expect(new Uint8Array(result)).toEqual(shortPng);
  });

  it("B2.6: WebP image without metadata chunks is preserved byte-for-byte", () => {
    // Construct valid WebP with RIFF header, WEBP FourCC, VP8 chunk (no EXIF/XMP)
    // RIFF (4) + Size (4) + WEBP (4) + VP8 (4) + Size (4) + Data (4)
    const cleanWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x10, 0x00, 0x00, 0x00, // Size
      0x57, 0x45, 0x42, 0x50, // "WEBP"
      0x56, 0x50, 0x38, 0x20, // "VP8 "
      0x04, 0x00, 0x00, 0x00, // Chunk size: 4
      0xaa, 0xbb, 0xcc, 0xdd, // Payload
    ]);

    const result = stripExifFromBuffer(cleanWebp.buffer, "image/webp");
    expect(new Uint8Array(result)).toEqual(cleanWebp);
  });
});
