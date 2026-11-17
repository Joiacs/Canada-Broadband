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

/**
 * Real speed-test submissions point at regions by id. Reloading boundaries or
 * hexagons has to clear those links first (foreign keys), so they are copied
 * here and restored afterwards wherever the region still exists. Synthetic
 * "devseed" rows are not kept.
 */
export async function backupCommunityAreas(sql: Sql) {
  await sql`
    create table if not exists bb.community_area_backup (
      id bigint primary key, pr_id text, cd_id text, csd_id text, hex_id text)`;
  await sql`
    insert into bb.community_area_backup (id, pr_id, cd_id, csd_id, hex_id)
    select id, pr_id, cd_id, csd_id, hex_id from bb.community_tests
    where client_key not like 'devseed-%' and coalesce(pr_id, cd_id, csd_id, hex_id) is not null
    on conflict (id) do update set
      pr_id = coalesce(excluded.pr_id, bb.community_area_backup.pr_id),
      cd_id = coalesce(excluded.cd_id, bb.community_area_backup.cd_id),
      csd_id = coalesce(excluded.csd_id, bb.community_area_backup.csd_id),
      hex_id = coalesce(excluded.hex_id, bb.community_area_backup.hex_id)`;
}

export async function restoreCommunityAreas(sql: Sql) {
  const res = await sql`
    update bb.community_tests c set
      pr_id  = coalesce(c.pr_id,  (select r.id from bb.regions r where r.id = b.pr_id)),
      cd_id  = coalesce(c.cd_id,  (select r.id from bb.regions r where r.id = b.cd_id)),
      csd_id = coalesce(c.csd_id, (select r.id from bb.regions r where r.id = b.csd_id)),
      hex_id = coalesce(c.hex_id, (select r.id from bb.regions r where r.id = b.hex_id))
    from bb.community_area_backup b
    where b.id = c.id`;
  return res.count;
}

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
