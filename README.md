# Ideva Broadband

Canada's internet speed map, built by Ideva Inc. It shows:

- **Measured speeds**: open [M-Lab](https://www.measurementlab.net/) NDT tests, plus tests people run on our own speed-test page.
- **Advertised availability**: ISED's [National Broadband Data](https://open.canada.ca/data/en/dataset/00a331db-121b-445d-b119-35dbbe3eedd9), computed exactly from pseudo-household points.
- **The gap between the two**, for provinces, census divisions, communities and 25 km² hexagons.

The site is fully bilingual (English and French). It includes a speed test, open-data CSV downloads and a JSON API.

This replaces the 2023 prototype (`IdevaInc/map-example`), which used OpenLayers, GeoServer/Tomcat and a local Postgres.

```
 Browser ──► Next.js 16 on Vercel ──► Supabase Postgres + PostGIS (ca-central-1)
   │           • map, speed test,           ▲               ▲
   │             region pages (EN/FR)        │ nightly       │ submissions
   │           • /api/* (cached)             │               │
   ├─► boundaries.pmtiles on Cloudflare R2   │        /api/tests ◄── ndt7 test ──► M-Lab servers
   └─► basemap: OpenFreeMap          GitHub Actions: M-Lab BigQuery → rollups
```

| Piece | Tech |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind v4 |
| Map | MapLibre GL 6 (globe), PMTiles vector tiles, OpenFreeMap basemap |
| Speed test | `@m-lab/ndt7`, Cloudflare Turnstile |
| Data | Postgres 17 + PostGIS on Supabase; histogram rollups (`bb.daily_stats`) |
| Pipeline | TypeScript scripts (`pipeline/`), GDAL `ogr2ogr`, `tippecanoe`, BigQuery |
| Quality | Vitest, Playwright, ESLint, GitHub Actions |

## Quick start (local)

Requirements: Node 22+, pnpm 9, Docker, the Supabase CLI, GDAL (`ogr2ogr`) and `tippecanoe` (`brew install gdal tippecanoe supabase/tap/supabase`).

```bash
pnpm install                      # also copies MapLibre/ndt7 worker files into public/
cp .env.example .env.local        # local defaults work as-is
pnpm db:start                     # Postgres + PostGIS in Docker (ports 553xx)
pnpm db:reset                     # apply supabase/migrations

# Data (one time). See docs/DATA.md for where the files come from.
pnpm pipeline:boundaries          # StatCan 2021 boundaries → bb.regions
pnpm pipeline:ised                # ISED availability (downloads ~400 MB once)
pnpm pipeline:tiles               # → public/tiles/boundaries.pmtiles
pnpm pipeline:dev-seed            # SYNTHETIC tests so the map has colour (local only)
#   or real data: pnpm pipeline:mlab --from 2026-08-01 --to 2026-11-01   (needs GCP)

pnpm dev                          # http://localhost:3000
```

> `pipeline:dev-seed` writes **fake** test results and refuses to run against a non-local database. Remove them with `pnpm pipeline:dev-seed --clear`.

StatCan blocks some automated downloads. If `pipeline:boundaries` can't download the three StatCan zips, download them in a browser (see the comment at the top of `pipeline/boundaries.ts`) into `pipeline/data/raw/statcan/`. To try the app without them, run `pnpm pipeline:boundaries --legacy ../map-example/geojson_data`, which uses the 2023 prototype files. Those have provinces and divisions only.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` · `typecheck` · `test` · `test:e2e` | Quality checks (e2e needs a seeded DB) |
| `pnpm db:start` · `db:reset` · `db:stop` | Local Supabase Postgres |
| `pnpm pipeline:boundaries [--legacy dir]` | Load provinces, census divisions and subdivisions |
| `pnpm pipeline:ised [--refresh]` | Load ISED hexagons, exact 50/10 availability and providers per hexagon |
| `pnpm pipeline:tiles [--out file]` | Build `boundaries.pmtiles` |
| `pnpm pipeline:mlab --from --to` | Backfill M-Lab tests from BigQuery |
| `pnpm pipeline:nightly` | Nightly import, verification, rollups and retention |

## Project layout

```
src/
  app/[locale]/        pages: map, speed-test, region/[slug], methodology, data, about, privacy
  app/api/             stats, meta, regions/[id], regions/search, regions/names, tests (POST), export (CSV), health
  components/map/      MapLibre view, filters, legend, region panel, table view
  components/speedtest speed test UI (ndt7), gauge, Turnstile
  content/             long-form page text (EN + FR)
  i18n/                locale routing + dictionaries (fr.ts must match en.ts — type-checked)
  lib/                 data access (cached), histogram maths, validation, security helpers
  proxy.ts             locale redirect + French URL slugs
pipeline/              data pipeline (TypeScript, run with tsx)
supabase/migrations/   database schema (schema `bb`)
tests/                 unit (Vitest) and e2e (Playwright)
docs/                  deployment, data and operations guides
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): step-by-step production setup (Supabase, Vercel, Cloudflare, Google Cloud, GitHub)
- [docs/DATA.md](docs/DATA.md): data sources, licences, how the statistics are computed, and refreshing ISED and boundaries
- [docs/OPERATIONS.md](docs/OPERATIONS.md): nightly job, monitoring, maintaining the ISP list, costs, troubleshooting
- The public [methodology page](src/content/methodology.tsx) explains the statistics in plain language.

## Licence

Code © Ideva Inc. Published statistics are released under CC BY 4.0. Underlying data: M-Lab (CC0), ISED and Statistics Canada (Open Government Licence – Canada).
