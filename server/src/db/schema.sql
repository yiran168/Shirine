-- Shirine D1 Database Initialization SQL (Material 3 Expressive Dynamic Full-Stack System)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('superadmin', 'admin', 'user')),
  avatar TEXT DEFAULT '',
  nickname TEXT DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0 CHECK(points >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'banned')),
  last_checkin_date TEXT,
  checkin_streak INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

CREATE TABLE IF NOT EXISTS checkin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS checkin_user_idx ON checkin_records(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  alias TEXT,
  permalink TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  draft INTEGER NOT NULL DEFAULT 0,
  comment_enabled INTEGER NOT NULL DEFAULT 1,
  permission_type TEXT NOT NULL DEFAULT 'public' CHECK(permission_type IN ('public', 'login_required', 'points_required')),
  required_points INTEGER NOT NULL DEFAULT 0 CHECK(required_points >= 0),
  encrypted INTEGER NOT NULL DEFAULT 0,
  password TEXT DEFAULT '',
  password_hint TEXT DEFAULT '',
  hide_home_content INTEGER NOT NULL DEFAULT 1,
  uid INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
CREATE INDEX IF NOT EXISTS posts_perm_idx ON posts(permission_type);
CREATE INDEX IF NOT EXISTS posts_date_idx ON posts(created_at);

CREATE TABLE IF NOT EXISTS post_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL CHECK(points_spent >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL DEFAULT 'masonry',
  columns INTEGER NOT NULL DEFAULT 3,
  permission_type TEXT NOT NULL DEFAULT 'public' CHECK(permission_type IN ('public', 'login_required', 'points_required')),
  required_points INTEGER NOT NULL DEFAULT 0 CHECK(required_points >= 0),
  draft INTEGER NOT NULL DEFAULT 0,
  uid INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS album_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT DEFAULT '',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS album_photos_album_idx ON album_photos(album_id);

CREATE TABLE IF NOT EXISTS album_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL CHECK(points_spent >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, album_id)
);

CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL UNIQUE,
  location TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  draft INTEGER NOT NULL DEFAULT 0,
  uid INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,
  uid INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  desc TEXT DEFAULT '',
  avatar TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  accepted INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uid INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS site_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  guest_name TEXT DEFAULT '',
  guest_email TEXT DEFAULT '',
  guest_website TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'approved',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
