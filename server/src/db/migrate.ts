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
    `CREATE TABLE IF NOT EXISTS checkin_records (
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
    `ALTER TABLE albums ADD COLUMN tags TEXT DEFAULT '[]';`,
    `ALTER TABLE albums ADD COLUMN layout TEXT NOT NULL DEFAULT 'masonry';`,
    `ALTER TABLE albums ADD COLUMN columns INTEGER NOT NULL DEFAULT 3;`,
    `ALTER TABLE albums ADD COLUMN uid INTEGER REFERENCES users(id) ON DELETE SET NULL;`,

    // users
    `ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';`,
    `ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';`,
    `ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE users ADD COLUMN last_checkin_date TEXT;`,
    `ALTER TABLE users ADD COLUMN checkin_streak INTEGER NOT NULL DEFAULT 0;`,

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
    `ALTER TABLE posts ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE posts ADD COLUMN lang TEXT DEFAULT 'zh_CN';`,
    `ALTER TABLE posts ADD COLUMN category TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN tags TEXT DEFAULT '[]';`,
    `ALTER TABLE posts ADD COLUMN image TEXT DEFAULT '';`,
    `ALTER TABLE posts ADD COLUMN uid INTEGER REFERENCES users(id) ON DELETE SET NULL;`,

    // moments
    `ALTER TABLE moments ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE moments ADD COLUMN location TEXT DEFAULT '';`,
    `ALTER TABLE moments ADD COLUMN mood TEXT DEFAULT '';`,
    `ALTER TABLE moments ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE moments ADD COLUMN tags TEXT DEFAULT '[]';`,
    `ALTER TABLE moments ADD COLUMN images TEXT DEFAULT '[]';`,
    `ALTER TABLE moments ADD COLUMN uid INTEGER REFERENCES users(id) ON DELETE SET NULL;`,

    // friends
    `ALTER TABLE friends ADD COLUMN desc TEXT DEFAULT '';`,
    `ALTER TABLE friends ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE friends ADD COLUMN accepted INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE friends ADD COLUMN uid INTEGER REFERENCES users(id) ON DELETE SET NULL;`,

    // pages
    `ALTER TABLE pages ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE pages ADD COLUMN uid INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
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
