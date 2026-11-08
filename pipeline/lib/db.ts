import postgres from "postgres";
import { requireEnv } from "./env";

/**
 * Pipeline connection. Use the *direct* (session) connection string here —
 * the pipeline runs long statements, COPY and multi-statement transactions.
 */
export function connect() {
  const url = process.env.PIPELINE_DATABASE_URL || requireEnv("DATABASE_URL");
  return postgres(url, {
    max: 4,
    idle_timeout: 20,
    onnotice: () => {},
    connection: { search_path: "bb,public", statement_timeout: 0 },
  });
}

export type Sql = ReturnType<typeof connect>;

/** Record a pipeline run in bb.pipeline_runs and always close the pool. */
export async function runJob(job: string, fn: (sql: Sql) => Promise<Record<string, unknown> | void>) {
  const sql = connect();
  const [run] = await sql<{ id: number }[]>`insert into bb.pipeline_runs (job) values (${job}) returning id`;
  const t0 = Date.now();
  try {
    const detail = (await fn(sql)) ?? {};
    const out = { ...detail, seconds: Math.round((Date.now() - t0) / 1000) };
    await sql`update bb.pipeline_runs set finished_at = now(), ok = true, detail = ${sql.json(out as postgres.JSONValue)} where id = ${run.id}`;
    console.log(`✔ ${job}`, out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`update bb.pipeline_runs set finished_at = now(), ok = false, detail = ${sql.json({ error: message })} where id = ${run.id}`.catch(() => {});
    console.error(`✘ ${job} failed:`, err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
