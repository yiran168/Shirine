import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface D1Meta {
  changes: number;
  last_row_id: number;
  duration: number;
  served_by?: string;
  rows_read?: number;
  rows_written?: number;
}

export interface D1Response<T = unknown> {
  success: boolean;
  meta: D1Meta;
  results?: T[];
  error?: string;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1Meta;
  error?: string;
}

export class MockD1PreparedStatement {
  constructor(
    private db: Database,
    private query: string,
    private params: any[] = []
  ) {}

  bind(...values: any[]): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this.db, this.query, values);
  }

  async run<T = unknown>(): Promise<D1Response<T>> {
    try {
      const stmt = this.db.query(this.query);
      const res = stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: Number(res.changes),
          last_row_id: Number(res.lastInsertRowid),
          duration: 1,
        },
        results: [],
      };
    } catch (err: any) {
      throw err;
    }
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    try {
      const stmt = this.db.query(this.query);
      const rows = (stmt.all(...this.params) as T[]) || [];
      return {
        results: rows,
        success: true,
        meta: {
          changes: 0,
          last_row_id: 0,
          duration: 1,
        },
      };
    } catch (err: any) {
      throw err;
    }
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const stmt = this.db.query(this.query);
    return stmt.values(...this.params) as T[];
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const stmt = this.db.query(this.query);
    const row = stmt.get(...this.params) as any;
    if (!row) return null;
    if (colName) return row[colName] ?? null;
    return row as T;
  }

  // Internal execution for transactions
  _executeInTransaction(): D1Response<any> {
    const stmt = this.db.query(this.query);
    const res = stmt.run(...this.params);
    return {
      success: true,
      meta: {
        changes: Number(res.changes),
        last_row_id: Number(res.lastInsertRowid),
        duration: 1,
      },
      results: [],
    };
  }
}

export class MockD1Database {
  public sqlite: Database;

  constructor(memory = true, customPath?: string) {
    this.sqlite = new Database(customPath || ":memory:");
  }

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this.sqlite, query);
  }

  async batch<T = unknown>(statements: MockD1PreparedStatement[]): Promise<D1Response<T>[]> {
    const results: D1Response<T>[] = [];
    this.sqlite.query("BEGIN").run();
    try {
      for (const stmt of statements) {
        results.push(stmt._executeInTransaction());
      }
      this.sqlite.query("COMMIT").run();
      return results;
    } catch (err) {
      this.sqlite.query("ROLLBACK").run();
      throw err;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.sqlite.exec(sql);
    return { count: 1, duration: 1 };
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  close(): void {
    this.sqlite.close();
  }
}

export function createMockD1Database(initSchema = true): MockD1Database {
  const d1 = new MockD1Database();
  if (initSchema) {
    const schemaPath = resolve(__dirname, "../../server/src/db/schema.sql");
    const sql = readFileSync(schemaPath, "utf-8");
    d1.sqlite.exec(sql);
  }
  return d1;
}
