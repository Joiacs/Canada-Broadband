# Data

## Sources

| Data | Source | Licence | Refresh |
|---|---|---|---|
| Speed tests | M-Lab NDT, BigQuery `measurement-lab.ndt.unified_downloads` / `unified_uploads` | CC0 | Nightly (`pipeline:nightly`) |
| Community tests | Our `/speed-test` page (also M-Lab NDT) | Ours, CC BY 4.0 as aggregates | Live |
| Advertised availability | ISED National Broadband Data: `NBD_PHH_Speeds.zip` (current speeds per pseudo-household), `PHH_2021_CSV.zip` (pseudo-household points), `Map_Data_Shapefile.zip` / `Map_Data_CSV.zip` (hexagons, providers) | OGL – Canada | When ISED publishes (check the dataset page about twice a year), then `pipeline:ised --refresh` + `pipeline:tiles` |
| Boundaries | Statistics Canada 2021 cartographic boundary files: `lpr_000b21a_e.zip`, `lcd_000b21a_e.zip`, `lcsd_000b21a_e.zip` | OGL – Canada | Census years (next: 2026 census boundaries) |
| Basemap | OpenFreeMap (OpenStreetMap) | ODbL | n/a |

### Getting the StatCan files
StatCan sometimes blocks scripted downloads. In a browser, open
<https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21>,
choose **Cartographic Boundary Files (CBF)**, format **Shapefile**, and download *Provinces/territories*, *Census divisions* and *Census subdivisions*. Save the three zips (names above) in `pipeline/data/raw/statcan/`, then run `pnpm pipeline:boundaries`.

## Geography

| Level | Id example | Count | Measured tests shown? |
|---|---|---|---|
| Province / territory | `pr:35` | 13 | M-Lab + community |
| Census division | `cd:3520` | 293 | M-Lab + community |
| Census subdivision ("community") | `csd:3520005` | ~5,100 | M-Lab + community |
| ISED hexagon (25 km², populated only) | `hex:ON49481118` | ~77,800 | community only |

M-Lab locates tests by IP address, which is usually accurate to the town at best, so M-Lab tests are never assigned to hexagons. Community tests are located by device location (rounded to ~100 m in the browser and never stored) or by a community the person searches for.

## How statistics are computed

1. **Raw rows.** `bb.mlab_tests` holds one row per M-Lab test, kept for `RAW_RETENTION_DAYS`. `bb.community_tests` holds one row per submission.
2. **De-duplication.** Each connection counts once per day: the median of its tests that day. Connections are identified by `sha256(salt | IP | date)`, computed **inside BigQuery** for M-Lab data and in the API for submissions.
3. **Rollups.** `bb.rollup_mlab()` / `bb.rollup_community()` write `bb.daily_stats`: one row per (source, direction, day, region, ISP) with `n`, `n_meet` (≥ 50 down / ≥ 10 up), a 28-bin speed histogram, and latency sums. ISP rows are kept for provinces and divisions only.
4. **Queries.** For any period, histograms are summed (`bb.hist_sum`). Medians and quartiles are interpolated on a log scale (`src/lib/hist.ts`), and "% meeting target" is exact because 10 and 50 Mbps are bin edges. Areas need ≥ 10 people to be coloured and are shown lighter under 30.
5. **Advertised availability.** For every pseudo-household, ISED says whether 50/10 is available (`Combined_50_10_Combine`). We sum population over pseudo-households by dissemination block and hexagon in Node, upload those aggregates, assign blocks to subdivisions by point-in-polygon, and roll up. The result is an exact population-weighted percentage per area (`bb.region_availability`).
6. **Community verification.** Submissions carry M-Lab test UUIDs. When the nightly import sees the same UUID, `bb.verify_community_tests()` compares speeds (±30%) and marks the submission `verified` or `rejected`. Submissions not seen within 7 days become `unverifiable` and stop counting. M-Lab's copy of a community test is excluded from the M-Lab rollup to avoid double counting.

## Changing boundaries

Re-running `pipeline:boundaries` deletes all rollups, because region ids may change. Afterwards:

```bash
pnpm pipeline:ised
pnpm pipeline:tiles               # then upload to R2
pnpm pipeline:mlab --from <first day you want> --to <yesterday>   # rebuild history from BigQuery
psql "$DATABASE_URL" -c "select bb.rollup_community('2020-01-01', current_date)"
```
