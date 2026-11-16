# Free demo hosting (Vercel Hobby + Supabase Free, dummy data)

For collecting feedback before the real launch. No domain, Cloudflare or Google Cloud needed; everything is free. The site shows a "demo data" banner, and the speed numbers are simulated. Advertised availability (ISED) is real.

What the demo uses:
- **Boundaries:** the 2023 prototype files (provinces + census divisions, from `../map-example/geojson_data`) plus ISED hexagons. No "Communities" level until the StatCan 2021 files are loaded.
- **Map tiles:** `public/tiles/boundaries.pmtiles` is committed to the repo and served by Vercel, so no separate tile hosting is needed. It was built from exactly these boundaries.
- **Speed data:** 60 days of fake tests from `pipeline:dev-seed`, keeping only the statistics (`--slim`) to stay under Supabase Free's 500 MB.

## 1. Supabase

1. supabase.com → **New project**: name `canada-broadband-demo`, a long letters-and-numbers DB password, **Region: Canada (Central)**, plan **Free**.
2. **Connect** → copy, replacing `[YOUR-PASSWORD]`:
   - **Session pooler** URI (port 5432): for loading data (step 2)
   - **Transaction pooler** URI (port 6543): for Vercel (step 3)
3. On your Mac, in the project folder:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>    # asks for the DB password
   supabase db push                             # applies the migrations
   ```

## 2. Load the demo data (from your Mac, ~3–5 min)

In **one** terminal (exported values override `.env.local`):
```bash
export PIPELINE_DATABASE_URL='<session pooler URI>'
pnpm pipeline:boundaries --legacy ../map-example/geojson_data
pnpm pipeline:ised
pnpm pipeline:dev-seed --days 60 --slim --allow-remote
```
The last command prints `databaseSize` (expect ~250–300 MB). Then close that terminal, so later commands go to your local database again.

Don't run `pipeline:tiles` here. The committed tile file already matches these boundaries.

## 3. Vercel

1. vercel.com → sign in with GitHub (plan **Hobby**) → **Add New → Project** → import your repo. Keep the defaults.
2. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **transaction pooler** URI (port 6543) |
   | `IP_HASH_SALT` | output of `openssl rand -base64 32` |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (Cloudflare's test key) |
   | `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` (test key) |

3. **Deploy.** Note the address, e.g. `https://canada-broadband.vercel.app`.
4. Add `NEXT_PUBLIC_SITE_URL` = that address → **Deployments → ⋯ → Redeploy**. (`NEXT_PUBLIC_` values are baked in at build time.)
5. Optional: **Settings → Functions → Function Region → Montréal, Canada (yul1)**, next to the database, then redeploy.

## 4. Check it

- The address opens the map with the yellow demo banner and coloured census divisions.
- `/api/health` shows `"ok": true`.
- Click a province or division: the side panel shows numbers and charts.
- **Français** in the header switches language.
- The speed test runs (it's a real M-Lab test; results added from the demo go into the demo database).

## Good to know

- **Supabase Free pauses after 7 days without activity.** If testers see errors after a quiet week, open the Supabase dashboard and click **Restore project**.
- The demo data doesn't update. The map's "Data through" date stays at the day you seeded, which is fine for feedback.
- The nightly M-Lab job in GitHub Actions skips itself while `GCP_PROJECT_ID` isn't set, so there are no failure emails.
- Every `git push` to `main` redeploys automatically.

## Moving to the real site later

Follow [DEPLOYMENT.md](DEPLOYMENT.md). On the same database you'd remove the fake data with `pnpm pipeline:dev-seed --clear --allow-remote`, load the StatCan boundaries, rebuild the tiles, and remove `NEXT_PUBLIC_DEMO_MODE` in Vercel.
