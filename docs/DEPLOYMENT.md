# Deploying Canada Broadband

The complete checklist, in order. Later steps need values from earlier ones, so keep a password manager (or a private note) open and record each value as you get it:

| Value | From step |
|---|---|
| `IP_HASH_SALT` | 0 |
| Domain name | 1 |
| Supabase project ref, DB password | 2 |
| Transaction pooler URL (port 6543) | 2 |
| Session pooler URL (port 5432) | 2 |
| Tiles URL (`https://tiles.<domain>`) | 4 |
| Turnstile site key + secret key | 4 |
| GCP project ID, service-account email, workload identity provider | 5 |

Time: about half a day. Monthly cost while testing: ~$0 (free tiers) + domain. At launch: ~US$45–50.

---

## 0. On your Mac

1. Push any unpushed commits: `git push`.
2. Install tools (skip any you already have):
   ```bash
   brew install gdal tippecanoe supabase/tap/supabase
   ```
3. Fix Google Cloud CLI (the copy in `~/Downloads/google-cloud-sdk` is broken). This is only needed for step 5; you can use the web console instead.
   ```bash
   rm -rf ~/Downloads/google-cloud-sdk
   brew install --cask google-cloud-sdk
   gcloud init
   ```
4. Generate the IP-hashing secret once and save it. The website and pipeline **must** use the same value, and it must never be committed:
   ```bash
   openssl rand -base64 32
   ```

## 1. Domain and Cloudflare account

1. Buy the domain (e.g. a `.ca` from a CIRA-certified registrar; Ideva Inc. meets the Canadian-presence rule).
2. Create a Cloudflare account → **Add a domain** → choose the **Free** plan.
3. At your registrar, replace the nameservers with the two Cloudflare gives you. Wait until Cloudflare shows the domain as **Active** (minutes to a few hours).
4. Cloudflare → **SSL/TLS → Overview** → set mode to **Full (strict)**.

## 2. Supabase (database)

1. Sign up at supabase.com → **New project**:
   - Name: `canada-broadband`
   - Database password: generate a strong one and save it. If it contains symbols like `@ # / ? %`, they must be URL-encoded inside connection strings. A long letters-and-numbers password avoids that.
   - **Region: Canada (Central)**. The privacy notice promises data is stored in Canada.
   - Plan: **Free** to test. The Free plan pauses after 7 days without activity, caps the database at 500 MB, and has no backups. Upgrade to **Pro** before launch.
2. When it's ready, click **Connect** and copy two URIs, replacing `[YOUR-PASSWORD]`:
   - **Transaction pooler** (port **6543**) → `DATABASE_URL` for Vercel.
   - **Session pooler** (port **5432**, host ends in `pooler.supabase.com`) → `PIPELINE_DATABASE_URL` for the data scripts and GitHub. Don't use "Direct connection": it's IPv6-only and GitHub's runners can't reach it.
3. Apply the schema from the project folder:
   ```bash
   cd ~/Desktop/"Broaband Canada Project"/ideva-broadband
   supabase login
   supabase link --project-ref <project-ref>      # asks for the DB password
   supabase db push                               # applies 3 migrations
   ```
4. Check: Supabase → **SQL Editor** → `select count(*) from bb.isps;` → `17`.

## 3. Load reference data into Supabase

1. Download the boundaries in a browser:
   <https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21>
   → **Cartographic Boundary Files** → format **Shapefile (.shp)** → download *Provinces/territories*, *Census divisions*, *Census subdivisions*. Save into `pipeline/data/raw/statcan/` named exactly:
   `lpr_000b21a_e.zip`, `lcd_000b21a_e.zip`, `lcsd000b21a_e.zip` (rename if needed).
2. In the same terminal, point the scripts at Supabase. Exported variables take priority over `.env.local`:
   ```bash
   export PIPELINE_DATABASE_URL='<session pooler URL>'
   export DATABASE_URL="$PIPELINE_DATABASE_URL"
   pnpm pipeline:boundaries        # ~5 min
   pnpm pipeline:ised              # ~2–5 min (downloads ~400 MB once)
   pnpm pipeline:tiles --out pipeline/data/build/boundaries-prod.pmtiles   # keeps your local tiles separate
   ```
3. Check in the SQL Editor:
   `select level, count(*) from bb.regions group by level;` → pr 13, cd 293, csd ≈ 5,100, hex ≈ 77,765.
4. Close that terminal (or `unset PIPELINE_DATABASE_URL DATABASE_URL`) so later local commands use your local database again. `pipeline:dev-seed` refuses to run against Supabase, so fake data can't reach production.

## 4. Cloudflare R2 (map tiles) and Turnstile (bot check)

**R2**
1. Cloudflare → **R2 Object Storage**. Enabling it asks for a payment method even on the free tier.
2. **Create bucket** → `canada-broadband-tiles` (location: Automatic).
3. Bucket → **Settings → Custom Domains → Connect Domain** → `tiles.<your-domain>`. Cloudflare adds the DNS record.
4. Bucket → **Settings → CORS policy → Edit**:
   ```json
   [{
     "AllowedOrigins": ["https://<your-domain>", "https://www.<your-domain>", "https://*.vercel.app", "http://localhost:3000"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["range", "if-match"],
     "ExposeHeaders": ["etag", "content-length", "content-range", "accept-ranges"],
     "MaxAgeSeconds": 86400
   }]
   ```
5. Upload:
   ```bash
   npx wrangler login
   npx wrangler r2 object put canada-broadband-tiles/boundaries.pmtiles \
     --file pipeline/data/build/boundaries-prod.pmtiles --content-type application/octet-stream --remote
   ```
6. Test: `curl -s -o /dev/null -w "%{http_code}\n" -H "Range: bytes=0-99" https://tiles.<your-domain>/boundaries.pmtiles` → `206`.

**Turnstile**
1. Cloudflare → **Turnstile → Add widget** → name `Canada Broadband`, hostnames `<your-domain>` and `www.<your-domain>`, mode **Managed**.
2. Save the **site key** and **secret key**.

## 5. Google Cloud (M-Lab data via BigQuery)

1. <https://console.cloud.google.com> → **New project** `canada-broadband`. Note the **Project ID**.
2. **Billing** → link a billing account. Then **Billing → Budgets & alerts** → budget US$20/month with email alerts. Normal nightly use falls within BigQuery's free monthly query allowance.
3. **APIs & Services → Enable**: *BigQuery API*, *IAM Service Account Credentials API*, *Security Token Service API*.
4. Check M-Lab access. In **BigQuery → SQL workspace**, run:
   ```sql
   SELECT COUNT(*) FROM `measurement-lab.ndt.unified_downloads`
   WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY) AND client.Geo.CountryCode = 'CA'
   ```
   If it's denied, follow M-Lab's quickstart (<https://www.measurementlab.net/data/docs/bq/quickstart/>). Historically, access was granted by joining M-Lab's *discuss* Google Group.
5. **IAM → Service accounts → Create**: `pipeline`, role **BigQuery Job User**. Note its email (`pipeline@<project-id>.iam.gserviceaccount.com`).
6. Let GitHub Actions use it without a key file:
   ```bash
   PROJECT=<project-id>
   REPO=Joiacs/Canada-Broadband
   gcloud iam workload-identity-pools create github --project=$PROJECT --location=global --display-name=GitHub
   gcloud iam workload-identity-pools providers create-oidc github --project=$PROJECT --location=global \
     --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository=='$REPO'"
   POOL=$(gcloud iam workload-identity-pools describe github --project=$PROJECT --location=global --format='value(name)')
   gcloud iam service-accounts add-iam-policy-binding pipeline@$PROJECT.iam.gserviceaccount.com --project=$PROJECT \
     --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/$POOL/attribute.repository/$REPO"
   gcloud iam workload-identity-pools providers describe github --project=$PROJECT --location=global \
     --workload-identity-pool=github --format='value(name)'
   ```
   The last command prints `projects/<number>/locations/global/workloadIdentityPools/github/providers/github`. That's `GCP_WORKLOAD_IDENTITY_PROVIDER`.

## 6. GitHub (`Joiacs/Canada-Broadband`)

1. **Actions** tab → confirm the **CI** run on `main` is green.
2. **Until step 5 is finished:** Actions → *Nightly data pipeline* → `···` → **Disable workflow**, so it doesn't fail and email you every night. Re-enable it afterwards.
3. **Settings → Secrets and variables → Actions**
   - **Secrets:** `PIPELINE_DATABASE_URL` (session pooler URL), `IP_HASH_SALT`
   - **Variables:** `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (the email), `RAW_RETENTION_DAYS` = `10` while on Supabase Free (`21` on Pro), and `SITE_URL` once step 7 is done (e.g. `https://<your-domain>`)
4. Load history: **Actions → Nightly data pipeline → Run workflow** with `backfill_from` / `backfill_to`:
   - On Supabase Free: about 3 months (e.g. `2026-08-01` → yesterday).
   - On Pro: about a year per run (each run has a 90-minute limit).

   Open the run's log. Each chunk prints "BigQuery will scan X GB", then the rows imported.
5. Optional: **Settings → Branches → Add rule** for `main` → require the **CI** status check.

## 7. Vercel (website)

1. Sign up at vercel.com with GitHub. **Hobby** is fine for testing; **Pro** is required once the site is used commercially.
2. **Add New → Project → Import** `Joiacs/Canada-Broadband` (grant the Vercel GitHub app access to the repo if asked). Framework **Next.js**, root `./`, default build/install commands. Don't deploy yet; add variables first.
3. **Environment Variables**:

   | Name | Production | Preview |
   |---|---|---|
   | `DATABASE_URL` | transaction pooler URL (6543) | same |
   | `IP_HASH_SALT` | your secret | same |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | same |
   | `NEXT_PUBLIC_TILES_URL` | `https://tiles.<your-domain>` | same |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | real site key | `1x00000000000000000000AA` (test key) |
   | `TURNSTILE_SECRET_KEY` | real secret | `1x0000000000000000000000000000000AA` (test key) |

   Variables starting with `NEXT_PUBLIC_` are baked in at build time: **redeploy after changing them**. Previews share the production database, so test submissions from previews are real rows.
4. **Deploy.** Then:
   - **Settings → Build & Deployment → Node.js Version** → 24.
   - **Settings → Functions → Function Region** → **Montréal, Canada (yul1)**, next to the Supabase database.
   - **Deployments → ⋯ → Redeploy**.
5. **Settings → Domains** → add `<your-domain>` and `www.<your-domain>` (set `www` to redirect to the bare domain). Vercel shows the DNS records it needs. Add exactly those in **Cloudflare → DNS** with the proxy **off (grey cloud)**.
6. Back in GitHub, set the variable `SITE_URL` = `https://<your-domain>`.

## 8. Check everything

- [ ] `https://<your-domain>` redirects to `/en` (or `/fr` for French browsers) and the map draws boundaries.
- [ ] `https://<your-domain>/api/health` → `"ok": true` and a recent `latest` date.
- [ ] Browser dev tools → Network: `boundaries.pmtiles` loads from `tiles.<your-domain>` with status **206** and no CORS errors.
- [ ] Map shows colours at all four levels after the backfill (hexagons need Ideva speed tests or *Advertised availability*).
- [ ] Run a **real speed test** on the live site and add it to the map. It should show within minutes. After the next nightly run, `select status from bb.community_tests order by id desc limit 1;` → `verified`.
- [ ] CSV download on `/en/data` works.
- [ ] `/sitemap.xml` lists region pages using your domain.
- [ ] Paste a link into a chat app: the preview image shows "Canada Broadband".
- [ ] Nightly workflow (re-enabled) passes two nights in a row.

## 9. Before announcing it

- [ ] Put a real privacy contact in `src/content/privacy.tsx` (`PRIVACY_CONTACT`; Quebec's Law 25 requires naming one), push, and have the notice reviewed.
- [ ] Upgrade **Supabase → Pro** (no pausing, 8 GB, daily backups), set GitHub `RAW_RETENTION_DAYS` = `21`, and backfill more history if wanted.
- [ ] Upgrade **Vercel → Pro**.
- [ ] **Google Search Console** → add the domain (verify with the TXT record in Cloudflare DNS) → submit `/sitemap.xml`.
- [ ] Uptime monitor (e.g. UptimeRobot or Better Stack, free) on `/api/health`, alerting you by email.
- [ ] Optional: register as an M-Lab integrator for higher speed-test rate limits (<https://www.measurementlab.net/develop/>).
- [ ] Old repo `IdevaInc/map-example`: change the database passwords in its history (`.env` and the Python scripts) wherever they're still used, then **Settings → Archive** (or make it private).

## Afterwards

See [OPERATIONS.md](OPERATIONS.md) (nightly job, monitoring, provider list, costs) and [DATA.md](DATA.md) (refreshing ISED about twice a year, new census boundaries).
