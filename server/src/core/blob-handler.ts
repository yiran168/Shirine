import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { and, eq, like, or } from "drizzle-orm";
import { verifyPostGrant, verifyAlbumGrant } from "./auth";
import { verifyMediaSignature } from "./media-access";
import { getPublicR2Url, LEGACY_R2_ORIGIN } from "./r2-config";

// A substring (or a SQL LIKE wildcard) is not evidence that an object was
// published. Match complete media paths after extracting URLs from Markdown/JSON.
function objectCandidates(column: Parameters<typeof like>[0], key: string) {
  return or(like(column, `%${key}%`), like(column, `%${key.split("/").map(encodeURIComponent).join("/")}%`));
}

function matchesObject(value: string | null | undefined, key: string, storageBases: string[], proxyOrigins: string[]): boolean {
  if (!value) return false;
  const urls = value.match(/(?:https?:\/\/[^\s"'<>()[\]\\]+|\/api\/(?:upload\/)?blob\/[^\s"'<>()[\]\\]+)/g) || [];
  return urls.some(source => {
    try {
      const base = storageBases.find(base => source.startsWith(base + "/"));
      if (base) return decodeURIComponent(source.slice(base.length + 1).split(/[?#]/)[0]) === key;
      const url = new URL(source, proxyOrigins[0]);
      if (!source.startsWith("/api/") && !proxyOrigins.includes(url.origin)) return false;
      if (!/^\/api\/(?:upload\/)?blob\//.test(url.pathname)) return false;
      return decodeURIComponent(url.pathname.replace(/^\/api\/(?:upload\/)?blob\//, "")) === key;
    } catch { return false; }
  });
}

/**
 * Handles /api/blob/* and /api/upload/blob/* requests with fail-closed security,
 * pre-R2 ACL checks, unattached asset gating, and reversible caching headers
 * (V10-P0-13, V10-P0-14, V10-P0-15, V10-P0-16, V10-P0-17).
 */
export async function handleBlobStream(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  rawKey?: string
): Promise<Response> {
  try {
    const key = rawKey || c.req.path.replace(/^(?:\/api)?(?:\/upload)?\/blob\/?/, "");
    if (!key) {
      return c.text("Key is required", 400);
    }

    if (!c.env.STORAGE) {
      return c.text("Storage bucket not bound", 404);
    }

    const decodedKey = decodeURIComponent(key);

    // Reject browser hotlinks before any database or R2 access. A short-lived
    // signature limits replay of copied public links; protected media still
    // requires the live account/grant checks below on every request.
    if (c.req.header("Sec-Fetch-Site") === "cross-site") return c.text("Hotlink denied", 403);
    const currentUser = c.get("user");
    const adminPreview = currentUser?.role === "admin" || currentUser?.role === "superadmin";
    if (!adminPreview && !await verifyMediaSignature(decodedKey, new URL(c.req.url), c.env)) return c.text("Media link expired or invalid", 403);
    if (!c.env.DB) return c.text("Media authorization unavailable", 503);

    const storageBases = [await getPublicR2Url(c.env), c.env.PUBLIC_R2_URL || "", LEGACY_R2_ORIGIN].filter(Boolean).map(base => base.replace(/\/+$/, ""));
    const proxyOrigins = [new URL(c.req.url).origin, ...(c.env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean)];
    const referencesObject = (value: string | null | undefined, objectKey: string) => matchesObject(value, objectKey, storageBases, proxyOrigins);

    // 1. Pre-R2 ACL Authorization Check (Fail-closed)
    let isProtected = false;
    let hasPublicReference = false;

    if (c.env.DB) {
      try {
        const db = getDb(c.env.DB);
        const user = c.get("user");
        const isAdmin = Boolean(user && (user.role === "superadmin" || user.role === "admin"));

        // A. Check ALL Album photos matching this asset key (V10-P0-13: no findFirst single-match race)
        const photoMatches = await db.query.albumPhotos.findMany({
          where: objectCandidates(schema.albumPhotos.url, decodedKey),
        });

        for (const photo of photoMatches) {
          if (!referencesObject(photo.url, decodedKey)) continue;
          const album = await db.query.albums.findFirst({
            where: eq(schema.albums.id, photo.albumId),
          });

          if (album) {
            const hasPassword = album.permissionType === "password" || album.encrypted === 1 || Boolean(album.password);
            if (album.draft === 1 || album.permissionType !== "public" || hasPassword) {
              isProtected = true;
              const isAuthor = Boolean(user && album.uid && user.id === album.uid);

              if (!isAdmin && !isAuthor) {
                if (!user && (!hasPassword || album.permissionType === "login_required" || album.permissionType === "points_required")) {
                  return c.text("Unauthorized: Authentication required to access protected media", 401);
                }
                if (album.draft === 1) {
                  return c.text("Forbidden: Draft album media is unpublished", 403);
                }
                if (album.permissionType === "points_required") {
                  if (!user) return c.text("Authentication required", 401);
                  const unlock = await db.query.albumUnlocks.findFirst({
                    where: and(
                      eq(schema.albumUnlocks.userId, user!.id),
                      eq(schema.albumUnlocks.albumId, album.id)
                    ),
                  });
                  if (!unlock) {
                    return c.text("Forbidden: Album must be unlocked before accessing media", 403);
                  }
                }
                if (hasPassword) {
                  const cookies = c.req.header("Cookie") || "";
                  let grant = c.req.header("X-Album-Grant") || cookies.match(new RegExp(`(?:^|;\\s*)shirine_album_grant_${album.id}=([^;]+)`))?.[1];
                  if (!grant) {
                    try { grant = JSON.parse(decodeURIComponent(cookies.match(/(?:^|;\s*)shirine_album_grants=([^;]+)/)?.[1] || "{}"))[album.id]; } catch {}
                  }
                  if (!grant || !await verifyAlbumGrant(grant, album.id, album.passwordVersion || 1, user?.id ?? null, c.env.JWT_SECRET)) return c.text("Album password verification required", 403);
                }
              }
            } else {
              hasPublicReference = true;
            }
          }
        }

        // B. Check ALL Posts referencing this asset key (V10-P0-16: Post media ACL)
        const postMatches = await db.query.posts.findMany({
          where: or(
            objectCandidates(schema.posts.image, decodedKey),
            objectCandidates(schema.posts.content, decodedKey)
          ),
        });

        for (const post of postMatches) {
          if (!referencesObject(post.image, decodedKey) && !referencesObject(post.content, decodedKey)) continue;
          const hasPassword = post.permissionType === "password" || post.encrypted === 1 || Boolean(post.password && post.password.length > 0);
          const isPostProtected = post.draft === 1 || post.permissionType !== "public" || hasPassword;

          if (isPostProtected) {
            isProtected = true;
            const isAuthor = Boolean(user && post.uid && user.id === post.uid);

            if (!isAdmin && !isAuthor) {
              if (post.draft === 1) {
                return c.text("Forbidden: Draft post media is unpublished", 403);
              }

              if (post.permissionType === "login_required" || post.permissionType === "points_required") {
                if (!user) {
                  return c.text("Unauthorized: Authentication required to access protected post media", 401);
                }
              }

              if (post.permissionType === "points_required") {
                const unlock = await db.query.postUnlocks.findFirst({
                  where: and(
                    eq(schema.postUnlocks.userId, user!.id),
                    eq(schema.postUnlocks.postId, post.id)
                  ),
                });
                if (!unlock) {
                  return c.text("Forbidden: Post must be unlocked before accessing media", 403);
                }
              }

              if (hasPassword) {
                // Check password grant
                const cookieHeader = c.req.header("Cookie") || "";
                let grant = c.req.header("X-Post-Grant");
                if (!grant) {
                  const grantsMatch = cookieHeader.match(/shirine_post_grants=([^;]+)/);
                  if (grantsMatch) {
                    try {
                      const map = JSON.parse(decodeURIComponent(grantsMatch[1]));
                      grant = map?.[post.id];
                    } catch {}
                  }
                }
                if (!grant) {
                  const singleMatch = cookieHeader.match(new RegExp(`shirine_post_grant_${post.id}=([^;]+)`));
                  if (singleMatch) grant = singleMatch[1];
                }

                if (!grant) {
                  return c.text("Forbidden: Password verification required to access media", 403);
                }

                const valid = await verifyPostGrant(
                  grant,
                  post.id,
                  post.passwordVersion || 1,
                  user ? user.id : null,
                  c.env.JWT_SECRET
                );
                if (!valid) {
                  return c.text("Forbidden: Invalid or expired password grant", 403);
                }
              }
            }
          } else {
            hasPublicReference = true;
          }
        }

        // C. Check Custom Pages referencing this asset key (V10-P0-16)
        const pageMatches = await db.query.pages.findMany({
          where: objectCandidates(schema.pages.content, decodedKey),
        });

        for (const page of pageMatches) {
          if (!referencesObject(page.content, decodedKey)) continue;
          if (page.draft === 1) {
            isProtected = true;
            const isAuthor = Boolean(user && page.uid && user.id === page.uid);
            if (!isAdmin && !isAuthor) {
              return c.text("Forbidden: Draft page media is unpublished", 403);
            }
          } else {
            hasPublicReference = true;
          }
        }

        // D. Check Moments referencing this asset key (V10-P0-16)
        const momentMatches = await db.query.moments.findMany({
          where: or(
            objectCandidates(schema.moments.content, decodedKey),
            objectCandidates(schema.moments.images, decodedKey)
          ),
        });

        for (const moment of momentMatches) {
          if (!referencesObject(moment.content, decodedKey) && !referencesObject(moment.images, decodedKey)) continue;
          if (moment.draft === 1) {
            isProtected = true;
            const isAuthor = Boolean(user && moment.uid && user.id === moment.uid);
            if (!isAdmin && !isAuthor) {
              return c.text("Forbidden: Draft moment media is unpublished", 403);
            }
          } else {
            hasPublicReference = true;
          }
        }

        // E. Check Site Configs, Friends, and User avatars for public references
        if (!hasPublicReference && !isProtected) {
          const covers = await db.query.albums.findMany({ where: and(objectCandidates(schema.albums.cover, decodedKey), eq(schema.albums.draft, 0)) });
          hasPublicReference = covers.some(album => referencesObject(album.cover, decodedKey));
        }
        if (!hasPublicReference && !isProtected) {
          const friendMatches = await db.query.friends.findMany({
            where: and(objectCandidates(schema.friends.avatar, decodedKey), eq(schema.friends.accepted, 1)),
          });
          hasPublicReference = friendMatches.some(friend => referencesObject(friend.avatar, decodedKey));
        }
        if (!hasPublicReference && !isProtected) {
          const userMatches = await db.query.users.findMany({
            where: objectCandidates(schema.users.avatar, decodedKey),
          });
          hasPublicReference = userMatches.some(user => referencesObject(user.avatar, decodedKey));
        }
        if (!hasPublicReference && !isProtected) {
          const siteMatches = await db.query.siteConfigs.findMany({
            where: objectCandidates(schema.siteConfigs.value, decodedKey),
          });
          hasPublicReference = siteMatches.some(config => referencesObject(config.value, decodedKey));
        }

        // F. Unattached / Unpublished Asset Gating (V10-P0-17)
        // If an asset is not associated with ANY published public content, it remains private_unattached.
        // Anonymous/regular visitors cannot access it until it is officially published.
        if (!isProtected && !hasPublicReference) {
          if (!isAdmin) {
            return c.text("Forbidden: Unattached or unpublished asset", 403);
          }
          // Admin may preview their newly uploaded asset, but with private no-cache headers
          isProtected = true;
        }
      } catch (err: any) {
        // V10-P0-14 fail-closed: DB error during authorization MUST NOT leak file
        console.error("Blob authorization check failed with database error:", err);
        return c.text("Media authorization backend unavailable", 503);
      }
    }

    // 2. Fetch from R2 ONLY AFTER authorization passes (V10-P0-14)
    const object = await c.env.STORAGE.get(decodedKey);
    if (!object) {
      return c.text("Object not found", 404);
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

    // Recheck authorization after permission changes; never cache ACL responses at an edge.
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");

    return new Response(object.body, { headers });
  } catch (err: any) {
    return c.text("Error fetching file", 500);
  }
}
