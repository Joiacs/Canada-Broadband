# Deploying Canada Broadband

Expect about half a day the first time. Every step only has to be done once.

| Service | Purpose | Plan |
|---|---|---|
| **Supabase** | Postgres + PostGIS | Free is enough for testing. Use **Pro (~US$25/mo)** at launch: the free plan's 500 MB fills up within months |
| **Vercel** | Hosts the Next.js app | **Pro (~US$20/mo)**, because the Hobby plan doesn't allow commercial use |
| **Cloudflare** | R2 storage for map tiles + Turnstile | Free tiers are enough |
| **Google Cloud** | BigQuery queries against M-Lab's public data | Pay-as-you-go. The nightly job scans a few GB, normally inside the free monthly allowance |
| **GitHub** | Code, CI, nightly pipeline | Free |
| **Domain** | e.g. `ideva-broadband.ca` | ~$15–25/yr |

Generate one secret now and use it everywhere `IP_HASH_SALT` appears. The app and pipeline **must** share it:

```bash
openssl rand -base64 32
```

---

## 1. Supabase (database)

1. Create a project. **Region: Canada (Central), `ca-central-1`.** The privacy notice says data is stored in Canada.
2. Save the database password somewhere safe.
3. Copy two connection strings from **Project Settings → Database → Connection string**:
   - **Transaction pooler** (port **6543**): used by the **app** (`DATABASE_URL` in Vercel).
   - **Session pooler** (port **5432** on the `pooler.supabase.com` host): used by the **pipeline** (`PIPELINE_DATABASE_URL`). Don't use the "direct connection" host. It is IPv6-only, and GitHub Actions runners can't reach it.
4. Apply the schema from your machine:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push            # applies supabase/migrations/*
   ```

All tables live in the `bb` schema, which is *not* exposed through Supabase's public Data API. The app connects with the connection string only.

## 2. Load reference data (from your machine)

```bash
export PIPELINE_DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-ca-central-1.pooler.supabase.com:5432/postgres"
export DATABASE_URL="$PIPELINE_DATABASE_URL"

pnpm pipeline:boundaries      # StatCan 2021 (download the 3 zips by hand if blocked; see docs/DATA.md)
pnpm pipeline:ised            # ~1 min; uploads only aggregates
pnpm pipeline:tiles           # writes public/tiles/boundaries.pmtiles locally
```

## 3. Cloudflare

### R2 bucket for map tiles
1. **R2 → Create bucket** → `ideva-broadband-tiles`.
2. **Settings → Public access → Custom domain** → e.g. `tiles.ideva-broadband.ca`. A custom domain enables caching. Don't use the `r2.dev` URL in production.
3. **Settings → CORS policy:**

   ```json
   [{
     "AllowedOrigins": ["https://ideva-broadband.ca", "https://*.vercel.app", "http://localhost:3000"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["range", "if-match"],
     "ExposeHeaders": ["etag", "content-length", "content-range", "accept-ranges"],
     "MaxAgeSeconds": 86400
   }]
   ```
4. Upload the tiles (repeat whenever you rebuild them):

   ```bash
   npx wrangler login
   npx wrangler r2 object put ideva-broadband-tiles/boundaries.pmtiles --file public/tiles/boundaries.pmtiles --remote
   ```
   Then `NEXT_PUBLIC_TILES_URL=https://tiles.ideva-broadband.ca`.

### Turnstile (bot protection)
**Turnstile → Add widget** → your domain(s), mode **Managed**. Copy the site key and secret key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without a secret, production builds **reject** submissions, which is the safe default.

## 4. Google Cloud (BigQuery for M-Lab)

1. Create a project (e.g. `ideva-broadband`) and enable the **BigQuery API**.
2. Check M-Lab's current access instructions at <https://www.measurementlab.net/data/docs/bq/quickstart/>. The data is public, and queries are billed to your project.
3. Create a service account `pipeline@<project>.iam.gserviceaccount.com` with role **BigQuery Job User** on your project.
4. Let GitHub Actions use it without a key file (Workload Identity Federation):

   ```bash
   PROJECT=ideva-broadband
   REPO=IdevaInc/ideva-broadband
   gcloud iam workload-identity-pools create github --project=$PROJECT --location=global
   gcloud iam workload-identity-pools providers create-oidc github --project=$PROJECT --location=global \
     --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository=='$REPO'"
   POOL=$(gcloud iam workload-identity-pools describe github --project=$PROJECT --location=global --format='value(name)')
   gcloud iam service-accounts add-iam-policy-binding pipeline@$PROJECT.iam.gserviceaccount.com --project=$PROJECT \
     --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/$POOL/attribute.repository/$REPO"
   gcloud iam workload-identity-pools providers describe github --project=$PROJECT --location=global \
     --workload-identity-pool=github --format='value(name)'   # → GCP_WORKLOAD_IDENTITY_PROVIDER
   ```
5. Set a **budget alert** (Billing → Budgets) at e.g. $20/month. The pipeline also refuses any single query that would scan more than `MLAB_MAX_GB_PER_QUERY` (default 60 GB).

## 5. GitHub

1. Create the repo `IdevaInc/ideva-broadband` (private is fine) and push:

   ```bash
   git remote add origin git@github.com:IdevaInc/ideva-broadband.git
   git push -u origin main
   ```
2. **Settings → Secrets and variables → Actions**
   - Secrets: `PIPELINE_DATABASE_URL` (session pooler), `IP_HASH_SALT`
   - Variables: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (the email), `SITE_URL` (e.g. `https://ideva-broadband.ca`), optionally `RAW_RETENTION_DAYS`
3. **Actions → Nightly data pipeline → Run workflow** with `backfill_from`/`backfill_to` to load history. Use about a year per run to stay within the 90-minute job limit. Without inputs it runs the normal nightly window.
4. Protect `main`: require the **CI** check to pass.

## 6. Vercel

1. **Add New → Project →** import the GitHub repo. Vercel detects Next.js and uses `pnpm`.
2. **Environment variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **transaction pooler** URL (port 6543) |
   | `IP_HASH_SALT` | same secret as the pipeline |
   | `NEXT_PUBLIC_SITE_URL` | `https://ideva-broadband.ca` |
   | `NEXT_PUBLIC_TILES_URL` | `https://tiles.ideva-broadband.ca` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | from Cloudflare |

3. **Settings → Functions → Region:** pick the region closest to Montréal (`ca-central-1`), so every database round trip is short.
4. **Settings → Domains:** add your domain and follow the DNS instructions.
5. Deploy. Check `https://<domain>/api/health` → `{"ok":true,…}`.

## 7. Launch checklist

- [ ] Fill in the privacy contact (`PRIVACY_CONTACT` in `src/content/privacy.tsx`). Quebec's Law 25 requires naming the person in charge of personal information. Have the notice reviewed.
- [ ] Real Turnstile keys in Vercel (not the test keys from `.env.example`).
- [ ] History backfilled; nightly workflow green for two nights in a row.
- [ ] `boundaries.pmtiles` built from **StatCan 2021** files (not `--legacy`) and uploaded to R2.
- [ ] Run one real speed test end-to-end on the production site and confirm it appears on the map.
- [ ] Uptime monitor on `/api/health` (e.g. Better Stack or UptimeRobot, free tiers).
- [ ] Google Search Console: verify the domain and submit `/sitemap.xml`.
- [ ] Optional: register as an M-Lab integrator for higher rate limits on the speed test (<https://www.measurementlab.net/develop/>).

### The old 2023 repo
`IdevaInc/map-example` has its `.env` (database credentials) committed in git history, and the Python scripts contain database passwords. Change those passwords wherever they're used. Then archive the repo (**Settings → Archive**), or make it private.
