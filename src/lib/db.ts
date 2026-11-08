import "server-only";
import postgres from "postgres";

const g = globalThis as unknown as { __ideva_sql?: postgres.Sql };

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Shared connection pool. In production DATABASE_URL should be Supabase's
 * *transaction pooler* URL (port 6543), so prepared statements are disabled.
 * All queries use fully-qualified `bb.` names because poolers ignore
 * per-connection search_path.
 */
export function db(): postgres.Sql {
  if (!g.__ideva_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__ideva_sql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      query_timeout: 20,
      onnotice: () => {},
    });
  }
  return g.__ideva_sql;
}
