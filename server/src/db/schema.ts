import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const createdAt = integer("created_at", { mode: "timestamp" })
  .default(sql`(unixepoch())`)
  .notNull();

const updatedAt = integer("updated_at", { mode: "timestamp" })
  .default(sql`(unixepoch())`)
  .notNull();

// Users Table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").default(""),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role", { enum: ["superadmin", "admin", "user"] }).default("user").notNull(),
  avatar: text("avatar").default(""),
  nickname: text("nickname").default(""),
  points: integer("points").default(0).notNull(),
  status: text("status", { enum: ["active", "banned"] }).default("active").notNull(),
  sessionVersion: integer("session_version").default(1).notNull(),
  lastCheckinDate: text("last_checkin_date"), // YYYY-MM-DD
  checkinStreak: integer("checkin_streak").default(0).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  usernameIdx: index("users_username_idx").on(table.username),
  emailIdx: index("users_email_idx").on(table.email),
  pointsCheck: check("users_points_check", sql`${table.points} >= 0`),
}));

// Check-in Records
export const checkinRecords = sqliteTable("checkin_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  checkinDate: text("checkin_date").notNull(), // YYYY-MM-DD
  pointsAwarded: integer("points_awarded").notNull(),
  createdAt,
}, (table) => ({
  userDateUnique: unique().on(table.userId, table.checkinDate),
  userIdx: index("checkin_user_idx").on(table.userId),
}));

// Blog Posts
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  alias: text("alias"),
  permalink: text("permalink"),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  content: text("content").notNull(),
  image: text("image").default("").notNull(),
  category: text("category").default("").notNull(),
  tags: text("tags").default("[]").notNull(), // JSON Array
  lang: text("lang").default("zh_CN"),
  pinned: integer("pinned").default(0).notNull(),
  draft: integer("draft").default(0).notNull(),
  commentEnabled: integer("comment_enabled").default(1).notNull(),
  permissionType: text("permission_type", { enum: ["public", "login_required", "points_required"] })
    .default("public")
    .notNull(),
  requiredPoints: integer("required_points").default(0).notNull(),
  encrypted: integer("encrypted").default(0).notNull(),
  password: text("password").default(""),
  passwordHint: text("password_hint").default(""),
  hideHomeContent: integer("hide_home_content").default(1).notNull(),
  passwordVersion: integer("password_version").default(1).notNull(),
  uid: integer("uid").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}, (table) => ({
  slugIdx: index("posts_slug_idx").on(table.slug),
  permIdx: index("posts_perm_idx").on(table.permissionType),
  dateIdx: index("posts_date_idx").on(table.createdAt),
  requiredPointsCheck: check("posts_required_points_check", sql`${table.requiredPoints} >= 0`),
}));

// Post Unlocks
export const postUnlocks = sqliteTable("post_unlocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  pointsSpent: integer("points_spent").notNull(),
  createdAt,
}, (table) => ({
  userPostUnique: unique().on(table.userId, table.postId),
  pointsSpentCheck: check("post_unlocks_points_spent_check", sql`${table.pointsSpent} >= 0`),
}));

// Albums
export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").unique(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  cover: text("cover").default("").notNull(),
  layout: text("layout").default("masonry").notNull(),
  columns: integer("columns").default(3).notNull(),
  tags: text("tags").default("[]"),
  hidden: integer("hidden").default(0).notNull(),
  permissionType: text("permission_type", { enum: ["public", "login_required", "points_required", "password"] })
    .default("public")
    .notNull(),
  requiredPoints: integer("required_points").default(0).notNull(),
  encrypted: integer("encrypted").default(0).notNull(),
  password: text("password").default(""),
  passwordHint: text("password_hint").default(""),
  passwordVersion: integer("password_version").default(1).notNull(),
  draft: integer("draft").default(0).notNull(),
  uid: integer("uid").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}, (table) => ({
  requiredPointsCheck: check("albums_required_points_check", sql`${table.requiredPoints} >= 0`),
}));

// Album Photos
export const albumPhotos = sqliteTable("album_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  albumId: integer("album_id").references(() => albums.id, { onDelete: "cascade" }).notNull(),
  url: text("url").notNull(),
  alt: text("alt").default(""),
  title: text("title").default(""),
  description: text("description").default(""),
  tags: text("tags").default("[]"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt,
}, (table) => ({
  albumIdx: index("album_photos_album_idx").on(table.albumId),
  albumUrlUnique: unique().on(table.albumId, table.url),
}));

// Album Unlocks
export const albumUnlocks = sqliteTable("album_unlocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  albumId: integer("album_id").references(() => albums.id, { onDelete: "cascade" }).notNull(),
  pointsSpent: integer("points_spent").notNull(),
  createdAt,
}, (table) => ({
  userAlbumUnique: unique().on(table.userId, table.albumId),
  pointsSpentCheck: check("album_unlocks_points_spent_check", sql`${table.pointsSpent} >= 0`),
}));

// Moments (动态)
export const moments = sqliteTable("moments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").unique().notNull(),
  location: text("location").default(""),
  mood: text("mood").default(""),
  images: text("images").default("[]").notNull(), // JSON [{ src, alt }]
  tags: text("tags").default("[]").notNull(),
  pinned: integer("pinned").default(0).notNull(),
  draft: integer("draft").default(0).notNull(),
  uid: integer("uid").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
});

// Independent Custom Pages
export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  draft: integer("draft").default(0).notNull(),
  uid: integer("uid").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
});

// Friends Links
export const friends = sqliteTable("friends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  desc: text("desc").default(""),
  avatar: text("avatar").notNull(),
  url: text("url").unique().notNull(),
  accepted: integer("accepted").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  uid: integer("uid").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
});

// Site Configuration
export const siteConfigs = sqliteTable("site_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt,
});

// System Configuration
export const systemConfigs = sqliteTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt,
});

// Comments
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  guestName: text("guest_name").default(""),
  guestEmail: text("guest_email").default(""),
  guestWebsite: text("guest_website").default(""),
  status: text("status").default("approved").notNull(),
  createdAt,
});

// Visits / Analytics
export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent").default(""),
  createdAt,
});

// System Setup State (Zero Concurrency Race)
export const setupState = sqliteTable("setup_state", {
  id: integer("id").primaryKey(),
  completed: integer("completed").default(0).notNull(),
  initializedAt: integer("initialized_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}, (table) => ({
  idCheck: check("setup_state_id_check", sql`${table.id} = 1`),
}));

// Point Transactions Ledger (V8-P0-01)
export const pointTransactions = sqliteTable("point_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  targetId: integer("target_id"),
  idempotencyKey: text("idempotency_key").unique(),
  description: text("description").default(""),
  createdAt,
}, (table) => ({
  userIdx: index("point_transactions_user_idx").on(table.userId),
}));

// Revoked Tokens (Per-session revocation: V8-P0-09, V8-P0-10)
export const revokedTokens = sqliteTable("revoked_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jti: text("jti").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt,
}, (table) => ({
  jtiIdx: index("revoked_tokens_jti_idx").on(table.jti),
}));
