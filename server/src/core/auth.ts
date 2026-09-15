import { SignJWT, jwtVerify } from "jose";
import type { UserPayload } from "../types";

/**
 * PBKDF2-HMAC-SHA256 password hashing with 100,000 iterations using native Web Crypto API.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies password against stored hash, supporting both PBKDF2 and legacy single-round SHA-256.
 */
export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const pbkdf2Hash = await hashPassword(password, salt);
  if (pbkdf2Hash === storedHash) return true;

  // Fallback support for legacy single-round SHA-256 hash
  const enc = new TextEncoder();
  const legacyBuffer = await crypto.subtle.digest("SHA-256", enc.encode(password + ":" + salt));
  const legacyHash = Array.from(new Uint8Array(legacyBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return legacyHash === storedHash;
}

export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signToken(payload: UserPayload, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({
    id: payload.id,
    username: payload.username,
    role: payload.role,
    sessionVersion: payload.sessionVersion ?? 1,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    const role =
      payload.role === "superadmin" || payload.role === "admin"
        ? (payload.role as "superadmin" | "admin")
        : "user";
    return {
      id: Number(payload.id),
      username: String(payload.username),
      role,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : undefined,
    };
  } catch {
    return null;
  }
}
