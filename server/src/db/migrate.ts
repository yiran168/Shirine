import { sql } from "drizzle-orm";
import type { getDb } from "./index";

/**
 * Ensures all required tables and columns exist in Cloudflare D1 database.
 * Completely idempotent and safe for existing deployments.
 */
export async function ensureD1Schema(d1?: D1Database, db?: ReturnType<typeof getDb>): Promise<void> {
  const tableStatements = [
    `CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      draft INTEGER NOT NULL DEFAULT 0,
      uid INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE TABLE IF NOT EXISTS post_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      points_spent INTEGER NOT NULL CHECK(points_spent >= 0),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, post_id)
    );`,
    `CREATE TABLE IF NOT EXISTS album_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      points_spent INTEGER NOT NULL CHECK(points_spent >= 0),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, album_id)
    );`,
    `CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      ref_type TEXT DEFAULT '',
      ref_id INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE TABLE IF NOT EXISTS checkin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points_awarded INTEGER NOT NULL,
      checkin_date TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, checkin_date)
    );`,
  ];

  for (const s of tableStatements) {
    try {
      if (d1) {
        await d1.prepare(s).run();
      } else if (db) {
        await db.run(sql.raw(s));
      }
    } catch {}
  }

  const columnMigrations = [
    // albums
    `ALTER TABLE albums ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE albums ADD COLUMN password TEXT DEFAULT '';`,
    `ALTER TABLE albums ADD COLUMN password_hint TEXT DEFAULT '';`,
    `ALTER TABLE albums ADD COLUMN password_version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE albums ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE albums ADD COLUMN permission_type TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE albums ADD COLUMN required_points INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE albums ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;`,
    // users
    `ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';`,
    // posts
    `ALTER TABLE posts ADD COLUMN alias TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN permalink TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE posts ADD COLUMN password TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN password_hint TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN password_version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE posts ADD COLUMN hide_home_content INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE posts ADD COLUMN comment_enabled INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE posts ADD COLUMN permission_type TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE posts ADD COLUMN required_points INTEGER NOT NULL DEFAULT 0;`,
    // moments
    `ALTER TABLE moments ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE moments ADD COLUMN location TEXT DEFAULT '';`,
    `ALTER TABLE moments ADD COLUMN mood TEXT DEFAULT '';`,
    // pages
    `ALTER TABLE pages ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
  ];

  for (const s of columnMigrations) {
    try {
      if (d1) {
        await d1.prepare(s).run();
      } else if (db) {
        await db.run(sql.raw(s));
      }
    } catch {
      // Ignored: column already exists
    }
  }
}
