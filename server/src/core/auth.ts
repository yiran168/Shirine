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
    .setIssuer("shirine-auth")
    .setAudience("shirine-client")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "shirine-auth",
      audience: "shirine-client",
    });

    if (!payload.jti || typeof payload.jti !== "string") return null;
    if (typeof payload.sessionVersion !== "number") return null;

    const role =
      payload.role === "superadmin" || payload.role === "admin"
        ? (payload.role as "superadmin" | "admin")
        : "user";
    return {
      id: Number(payload.id),
      username: String(payload.username),
      role,
      sessionVersion: payload.sessionVersion,
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}

/**
 * Signs a short-lived, purpose-bound password grant for accessing a password-protected post.
 * Binds post ID, current password version, and user ID (V10-P0-09, V10-P0-11).
 */
export async function signPostGrant(
  postId: number,
  passwordVersion: number,
  userId: number | null,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({
    type: "post_password_grant",
    postId,
    pv: passwordVersion,
    userId: userId ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("shirine-auth")
    .setAudience("shirine-post-grant")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey);
}

/**
 * Verifies a post password grant token against the requested postId,
 * its current passwordVersion, and the requesting userId (V10-P0-09, V10-P0-11).
 */
export async function verifyPostGrant(
  token: string,
  postId: number,
  expectedPasswordVersion: number,
  currentUserId: number | null,
  secret: string
): Promise<boolean> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "shirine-auth",
      audience: "shirine-post-grant",
    });

    if (payload.type !== "post_password_grant") return false;
    if (Number(payload.postId) !== Number(postId)) return false;
    // Password version mismatch (password was changed after grant was issued)
    if (Number(payload.pv) !== Number(expectedPasswordVersion)) return false;

    // User binding check (V10-P0-11): authenticated grants cannot be shared across accounts
    const grantUserId = Number(payload.userId || 0);
    if (grantUserId > 0) {
      if (!currentUserId || currentUserId !== grantUserId) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
  * Signs a short-lived, purpose-bound password grant for accessing a password-protected album.
  */
export async function signAlbumGrant(
  albumId: number,
  passwordVersion: number,
  userId: number | null,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({
    type: "album_password_grant",
    albumId,
    pv: passwordVersion,
    userId: userId ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("shirine-auth")
    .setAudience("shirine-album-grant")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey);
}

/**
  * Verifies an album password grant token against requested albumId and passwordVersion.
  */
export async function verifyAlbumGrant(
  token: string,
  albumId: number,
  expectedPasswordVersion: number,
  currentUserId: number | null,
  secret: string
): Promise<boolean> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "shirine-auth",
      audience: "shirine-album-grant",
    });

    if (payload.type !== "album_password_grant") return false;
    if (Number(payload.albumId) !== Number(albumId)) return false;
    if (Number(payload.pv) !== Number(expectedPasswordVersion)) return false;

    const grantUserId = Number(payload.userId || 0);
    if (grantUserId > 0) {
      if (!currentUserId || currentUserId !== grantUserId) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
