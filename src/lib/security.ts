import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

/** Client IP as seen by the platform (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

function salt() {
  const s = process.env.IP_HASH_SALT;
  if (!s) throw new Error("IP_HASH_SALT is not set");
  return s;
}

/**
 * One-way, per-day key for a client. Lets us count one result per household
 * per day without storing the IP, and can't be linked across days.
 */
export function dailyClientKey(ip: string, day: string): string {
  return createHash("sha256").update(`${salt()}|${ip}|${day}`).digest("hex");
}

/** Fixed-window rate limit stored in Postgres. Returns true if allowed. */
export async function rateLimit(ip: string, bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = createHash("sha256").update(`${salt()}|rl|${bucket}|${ip}`).digest("hex");
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db()<{ hits: number }[]>`
    insert into bb.rate_limits (key, window_start, hits) values (${key}, ${windowStart.toISOString()}::timestamptz, 1)
    on conflict (key, window_start) do update set hits = bb.rate_limits.hits + 1
    returning hits`;
  return row.hits <= limit;
}

/** Verify a Cloudflare Turnstile token. Skipped only if no secret is configured outside production. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

/** Today's date in Canada (Toronto) — matches bb.community_tests.day default. */
export function torontoDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
