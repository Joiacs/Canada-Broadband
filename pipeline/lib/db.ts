import postgres from "postgres";
import { requireEnv } from "./env";

/** The database the pipeline writes to (PIPELINE_DATABASE_URL, else DATABASE_URL). */
export function pipelineUrl() {
  return process.env.PIPELINE_DATABASE_URL || requireEnv("DATABASE_URL");
}

/**
 * Pipeline connection. Use a *session* connection string (local Postgres, or
 * Supabase's session pooler on port 5432) — the pipeline runs long statements.
 *
 * One connection, never closed while idle, so the session settings applied in
 * runJob() (no statement timeout) hold for every query. Startup parameters
 * aren't used because connection poolers may reject them.
 */
export function connect() {
  return postgres(pipelineUrl(), {
    max: 1,
    idle_timeout: 0,
    onnotice: () => {},
  });
}

export type Sql = ReturnType<typeof connect>;

/** Record a pipeline run in bb.pipeline_runs and always close the pool. */
export async function runJob(job: string, fn: (sql: Sql) => Promise<Record<string, unknown> | void>) {
  const sql = connect();
  await sql.unsafe("set statement_timeout = 0; set search_path = bb, public");
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
