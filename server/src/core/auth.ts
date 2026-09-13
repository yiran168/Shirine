import { SignJWT, jwtVerify } from "jose";
import type { UserPayload } from "../types";

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ":" + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return {
      id: Number(payload.id),
      username: String(payload.username),
      role: (payload.role === "superadmin" ? "superadmin" : "user") as "superadmin" | "user",
    };
  } catch {
    return null;
  }
}
