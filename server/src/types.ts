export interface Env {
  DB: D1Database;
  STORAGE?: R2Bucket;
  JWT_SECRET: string;
  PUBLIC_R2_URL?: string;
}

export interface UserPayload {
  id: number;
  username: string;
  role: 'superadmin' | 'user';
}

export type Variables = {
  user?: UserPayload;
};
