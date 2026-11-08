import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Download `url` to `dest` unless it already exists (pass force to refresh). */
export async function download(url: string, dest: string, force = false) {
  if (!force && existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  using cached ${path.basename(dest)}`);
    return dest;
  }
  ensureDir(path.dirname(dest));
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": "ideva-broadband-pipeline" } });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) for ${url}. If the site blocks automated downloads, download it in a browser and save it as ${dest}`);
  }
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(dest));
  return dest;
}

/** Run a command, streaming its stderr; rejects on non-zero exit. */
export function run(cmd: string, argv: string[], opts: { quiet?: boolean } = {}) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", opts.quiet ? "ignore" : "inherit", "inherit"] });
    p.on("error", (e) => reject(new Error(`${cmd} not found or failed to start: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

/** Spawn a command and return its stdout as a readable stream. */
export function stdoutOf(cmd: string, argv: string[]) {
  const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "inherit"] });
  const done = new Promise<void>((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
  return { stream: p.stdout, done };
}

/** List the entries of a zip archive. */
export async function zipEntries(zip: string): Promise<string[]> {
  const { stream, done } = stdoutOf("unzip", ["-Z1", zip]);
  const names: string[] = [];
  for await (const line of readline.createInterface({ input: stream })) names.push(line);
  await done;
  return names;
}

/** Iterate newline-delimited JSON (GeoJSONSeq) records in a file. */
export async function* readLines(file: string) {
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.replace(/^\x1e/, "").trim();
    if (t) yield t;
  }
}
