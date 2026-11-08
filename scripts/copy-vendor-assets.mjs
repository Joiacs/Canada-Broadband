// Copies browser worker scripts that must be served as standalone files:
//  - M-Lab ndt7 download/upload workers  → public/ndt7/
//  - MapLibre GL worker (self-contained) → public/maplibre/
// Runs on `pnpm install` (postinstall). The copies are git-ignored.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pub = path.join(process.cwd(), "public");

function copy(pkgFile, files, destDir) {
  let dir;
  try {
    dir = path.dirname(require.resolve(pkgFile));
  } catch {
    return; // not installed (e.g. pruned install) — nothing to do
  }
  mkdirSync(path.join(pub, destDir), { recursive: true });
  for (const f of files) {
    const src = path.join(dir, f);
    if (existsSync(src)) copyFileSync(src, path.join(pub, destDir, f));
  }
}

copy("@m-lab/ndt7/src/ndt7.js", ["ndt7-download-worker.js", "ndt7-upload-worker.js"], "ndt7");
copy("maplibre-gl/dist/maplibre-gl.css", ["maplibre-gl-worker.mjs"], "maplibre");
