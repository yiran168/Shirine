import type { Context } from "hono";
import type { Env, Variables } from "../types";
import { getDb, schema } from "../db";
import { and, eq, like, or } from "drizzle-orm";
import { verifyPostGrant } from "./auth";

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
          where: like(schema.albumPhotos.url, `%${decodedKey}%`),
        });

        for (const photo of photoMatches) {
          const album = await db.query.albums.findFirst({
            where: eq(schema.albums.id, photo.albumId),
          });

          if (album) {
            if (album.draft === 1 || album.permissionType !== "public") {
              isProtected = true;
              const isAuthor = Boolean(user && album.uid && user.id === album.uid);

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
            } else {
              hasPublicReference = true;
            }
          }
        }

        // B. Check ALL Posts referencing this asset key (V10-P0-16: Post media ACL)
        const postMatches = await db.query.posts.findMany({
          where: or(
            like(schema.posts.image, `%${decodedKey}%`),
            like(schema.posts.content, `%${decodedKey}%`)
          ),
        });

        for (const post of postMatches) {
          const hasPassword = post.encrypted === 1 || Boolean(post.password && post.password.length > 0);
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
          where: like(schema.pages.content, `%${decodedKey}%`),
        });

        for (const page of pageMatches) {
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
            like(schema.moments.content, `%${decodedKey}%`),
            like(schema.moments.images, `%${decodedKey}%`)
          ),
        });

        for (const moment of momentMatches) {
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
          const friendMatch = await db.query.friends.findFirst({
            where: like(schema.friends.avatar, `%${decodedKey}%`),
          });
          if (friendMatch) hasPublicReference = true;
        }
        if (!hasPublicReference && !isProtected) {
          const userMatch = await db.query.users.findFirst({
            where: like(schema.users.avatar, `%${decodedKey}%`),
          });
          if (userMatch) hasPublicReference = true;
        }
        if (!hasPublicReference && !isProtected) {
          const siteMatch = await db.query.siteConfigs.findFirst({
            where: like(schema.siteConfigs.value, `%${decodedKey}%`),
          });
          if (siteMatch) hasPublicReference = true;
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

    // 3. Cache-Control: Reversible cache headers (V10-P0-15)
    if (isProtected) {
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    } else {
      // Short / revalidatable cache so if public assets become protected later, they can be revoked
      headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    }

    return new Response(object.body, { headers });
  } catch (err: any) {
    return c.text("Error fetching file", 500);
  }
}
