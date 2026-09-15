export interface Env {
  DB: D1Database;
  STORAGE?: R2Bucket;
  JWT_SECRET: string;
  PUBLIC_R2_URL?: string;
  SETUP_TOKEN?: string;
  CF_TURNSTILE_SECRET?: string;
}

export interface UserPayload {
  id: number;
  username: string;
  role: 'superadmin' | 'admin' | 'user';
  sessionVersion?: number;
}

export type Variables = {
  user?: UserPayload;
};
