import app from "../../server/src/index";
import { getDb, schema } from "../../server/src/db";
import { hashPassword, generateSalt, signToken } from "../../server/src/core/auth";
import { createMockD1Database, type MockD1Database } from "./d1-mock";
import { createMockR2Bucket, type MockR2Bucket } from "./r2-mock";
import type { Env } from "../../server/src/types";

export interface TestEnvOptions {
  initSchema?: boolean;
  turnstileEnabled?: boolean;
  turnstileSecret?: string;
  jwtSecret?: string;
}

export interface CreatedUser {
  id: number;
  username: string;
  role: "superadmin" | "admin" | "user";
  points: number;
  avatar: string;
  token: string;
  cookie: string;
}

export class TestEnvironment {
  public d1: MockD1Database;
  public storage: MockR2Bucket;
  public env: Env;
  public db: ReturnType<typeof getDb>;
  public jwtSecret: string;

  constructor(options: TestEnvOptions = {}) {
    this.jwtSecret = options.jwtSecret || "shirine-test-jwt-secret-key-32bytes-min!";
    this.d1 = createMockD1Database(options.initSchema !== false);
    this.storage = createMockR2Bucket();
    this.env = {
      DB: this.d1 as any,
      STORAGE: this.storage as any,
      JWT_SECRET: this.jwtSecret,
      CF_TURNSTILE_SECRET: options.turnstileSecret || "1x0000000000000000000000000000000AA",
      ENVIRONMENT: "development",
      PUBLIC_R2_URL: "http://localhost/api/blob",
    };
    this.db = getDb(this.d1 as any);
  }

  async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = path.startsWith("http") ? path : `http://localhost${path}`;
    const req = new Request(url, options);
    return await app.fetch(req, this.env as any);
  }

  async requestJson<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ status: number; data: T; headers: Headers; res: Response }> {
    const res = await this.request(path, options);
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers, res };
  }

  async createSuperadmin(username = "superadmin", password = "adminpassword123"): Promise<CreatedUser> {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const insertRes = await this.db
      .insert(schema.users)
      .values({
        username,
        passwordHash,
        salt,
        role: "superadmin",
        nickname: "Super Admin",
        points: 1000,
        status: "active",
      })
      .returning();

    const user = insertRes[0];
    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, sessionVersion: 1 },
      this.jwtSecret
    );
    return {
      id: user.id,
      username: user.username,
      role: user.role as any,
      points: user.points,
      avatar: user.avatar || "",
      token,
      cookie: `shirine_token=${token}`,
    };
  }

  async createUser(
    username = `user_${Math.random().toString(36).slice(2, 8)}`,
    password = "userpassword123",
    points = 0
  ): Promise<CreatedUser> {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const insertRes = await this.db
      .insert(schema.users)
      .values({
        username,
        passwordHash,
        salt,
        role: "user",
        nickname: `User ${username}`,
        points,
        status: "active",
      })
      .returning();

    const user = insertRes[0];
    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, sessionVersion: 1 },
      this.jwtSecret
    );
    return {
      id: user.id,
      username: user.username,
      role: user.role as any,
      points: user.points,
      avatar: user.avatar || "",
      token,
      cookie: `shirine_token=${token}`,
    };
  }

  async createPost(overrides: Partial<typeof schema.posts.$inferInsert> = {}) {
    const slug = overrides.slug || `post-${Math.random().toString(36).slice(2, 8)}`;
    const res = await this.db
      .insert(schema.posts)
      .values({
        slug,
        title: overrides.title || `Test Post ${slug}`,
        content: overrides.content || "Hello World content for testing",
        category: overrides.category || "test",
        tags: overrides.tags || "[]",
        permissionType: overrides.permissionType || "public",
        requiredPoints: overrides.requiredPoints ?? 0,
        encrypted: overrides.encrypted ?? 0,
        password: overrides.password || "",
        draft: overrides.draft ?? 0,
        uid: overrides.uid ?? null,
        image: overrides.image || "",
      })
      .returning();
    return res[0];
  }

  async createAlbum(
    overrides: Partial<typeof schema.albums.$inferInsert> & {
      photos?: Array<{ url: string; alt?: string; title?: string; sortOrder?: number }>;
    } = {}
  ) {
    const title = overrides.title || `Test Album ${Math.random().toString(36).slice(2, 6)}`;
    const res = await this.db
      .insert(schema.albums)
      .values({
        slug: overrides.slug || `album-${Math.random().toString(36).slice(2, 8)}`,
        title,
        description: overrides.description || "Test album description",
        permissionType: overrides.permissionType || (overrides.password ? "password" : "public"),
        requiredPoints: overrides.requiredPoints ?? 0,
        encrypted: overrides.encrypted ?? (overrides.password ? 1 : 0),
        password: overrides.password || "",
        passwordHint: overrides.passwordHint || "",
        draft: overrides.draft ?? 0,
        uid: overrides.uid ?? null,
        cover: overrides.cover || "",
      })
      .returning();
    const album = res[0];

    if (overrides.photos && overrides.photos.length > 0) {
      for (const p of overrides.photos) {
        await this.db.insert(schema.albumPhotos).values({
          albumId: album.id,
          url: p.url,
          alt: p.alt || title,
          title: p.title || title,
          sortOrder: p.sortOrder || 1,
        });
      }
    }

    return album;
  }

  close(): void {
    this.d1.close();
  }
}

export function createTestEnv(options?: TestEnvOptions): TestEnvironment {
  return new TestEnvironment(options);
}
