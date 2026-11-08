"use client";

import Link from "next/link";
import { CheckCircle2, LocateFixed, MapPin, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import RegionSearch from "@/components/region-search";
import { localePath, type Locale } from "@/i18n/config";
import { fmt, formatMbps, type Messages } from "@/i18n/dictionary";
import { CONNECTION_TYPES } from "@/lib/submission";
import Gauge from "./gauge";
import Turnstile from "./turnstile";

type Phase = "idle" | "locating" | "download" | "upload" | "done" | "error";
type Result = { down: number; up: number; latency: number | null; uuidDown: string | null; uuidUp: string | null };
type Location = { type: "gps"; lat: number; lon: number } | { type: "search"; regionId: string; name: string };

const inputCls = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm focus:border-brand focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export default function SpeedTest({ t, locale }: { t: Messages; locale: Locale }) {
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [server, setServer] = useState<string | null>(null);
  const [liveDown, setLiveDown] = useState<number | null>(null);
  const [liveUp, setLiveUp] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = phase === "locating" || phase === "download" || phase === "upload";

  const start = async () => {
    setPhase("locating");
    setServer(null);
    setLiveDown(null);
    setLiveUp(null);
    setResult(null);
    setError(null);
    const r: Result = { down: 0, up: 0, latency: null, uuidDown: null, uuidUp: null };
    const upFromServer = (d: { TCPInfo?: { BytesReceived?: number; ElapsedTime?: number } }) =>
      d.TCPInfo?.BytesReceived && d.TCPInfo.ElapsedTime ? (d.TCPInfo.BytesReceived * 8) / d.TCPInfo.ElapsedTime : null;
    try {
      const ndt7 = (await import("@m-lab/ndt7")).default;
      let failed = false;
      const code = await ndt7.test(
        {
          userAcceptedDataPolicy: true,
          downloadworkerfile: "/ndt7/ndt7-download-worker.js",
          uploadworkerfile: "/ndt7/ndt7-upload-worker.js",
          metadata: { client_name: "ideva-broadband", client_version: "1.0.0" },
        },
        {
          error: (msg) => {
            failed = true;
            setError(String(msg));
          },
          serverChosen: (s) => setServer(s.location?.city ?? s.machine ?? null),
          downloadStart: () => setPhase("download"),
          downloadMeasurement: (m) => {
            if (m.Source === "client") setLiveDown(m.Data.MeanClientMbps);
            else {
              r.uuidDown ??= m.Data.ConnectionInfo?.UUID ?? null;
              if (m.Data.TCPInfo?.MinRTT) r.latency = m.Data.TCPInfo.MinRTT / 1000;
            }
          },
          downloadComplete: (c) => {
            r.down = c.LastClientMeasurement?.MeanClientMbps ?? 0;
            r.uuidDown = c.LastServerMeasurement?.ConnectionInfo?.UUID ?? r.uuidDown;
            if (c.LastServerMeasurement?.TCPInfo?.MinRTT) r.latency = c.LastServerMeasurement.TCPInfo.MinRTT / 1000;
            setLiveDown(r.down);
          },
          uploadStart: () => setPhase("upload"),
          uploadMeasurement: (m) => {
            // the server's byte count is the accurate figure for uploads
            if (m.Source === "server") {
              r.uuidUp ??= m.Data.ConnectionInfo?.UUID ?? null;
              const v = upFromServer(m.Data);
              if (v !== null) setLiveUp(v);
            }
          },
          uploadComplete: (c) => {
            r.up = (c.LastServerMeasurement && upFromServer(c.LastServerMeasurement)) ?? c.LastClientMeasurement?.MeanClientMbps ?? 0;
            r.uuidUp = c.LastServerMeasurement?.ConnectionInfo?.UUID ?? r.uuidUp;
            setLiveUp(r.up);
          },
        },
      );
      if (code !== 0 || failed || r.down <= 0) {
        setPhase("error");
        return;
      }
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="st-run" className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h2 id="st-run" className="sr-only">
          {t.speedTest.title}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Gauge value={liveDown} label={t.common.download} unit={t.units.mbps} active={phase === "download"} />
          <Gauge value={liveUp} label={t.common.upload} unit={t.units.mbps} active={phase === "upload"} />
        </div>
        <div className="mt-4 flex min-h-6 items-center justify-center gap-2 text-sm text-muted" aria-live="polite">
          {running && <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden />}
          <span>{t.speedTest.phases[phase]}</span>
          {server && running && <span>· {fmt(t.speedTest.server, { city: server })}</span>}
        </div>

        {phase === "idle" || phase === "error" ? (
          <div className="mt-5 space-y-4">
            {phase === "error" && (
              <p className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {t.speedTest.phases.error}
                  {error ? ` (${error})` : ""}
                </span>
              </p>
            )}
            <div className="rounded-lg border border-border bg-surface-2/60 p-4 text-sm leading-relaxed">
              <h3 className="mb-2 font-semibold">{t.speedTest.consentTitle}</h3>
              <p>{t.speedTest.consentMlab}</p>
              <p className="mt-2">{t.speedTest.consentIdeva}</p>
              <p className="mt-2 text-xs text-muted">
                <a className="underline" href="https://www.measurementlab.net/privacy/" target="_blank" rel="noreferrer">
                  {t.speedTest.mlabPolicy}
                </a>{" "}
                ·{" "}
                <Link className="underline" href={localePath(locale, "privacy")}>
                  {t.speedTest.ourPolicy}
                </Link>
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{t.speedTest.consentCheckbox}</span>
              </label>
            </div>
            <button
              type="button"
              disabled={!consent}
              onClick={start}
              className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white shadow-card transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="size-5" aria-hidden /> {phase === "error" ? t.common.retry : t.speedTest.start}
            </button>
            <p className="text-xs text-muted">{t.speedTest.tips}</p>
          </div>
        ) : phase === "done" && result ? (
          <Results result={result} t={t} locale={locale} onAgain={start} />
        ) : null}
      </section>

      <section aria-labelledby="st-share" className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h2 id="st-share" className="text-lg font-semibold">
          {t.speedTest.shareTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.speedTest.shareIntro}</p>
        {result ? <ShareForm result={result} t={t} locale={locale} /> : <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{t.speedTest.phases.idle} — {t.speedTest.start}</p>}
      </section>
    </div>
  );
}

function Results({ result, t, locale, onAgain }: { result: Result; t: Messages; locale: Locale; onAgain: () => void }) {
  const meets = result.down >= 50 && result.up >= 10;
  return (
    <div className="mt-5 space-y-3">
      <h3 className="font-semibold">{t.speedTest.resultTitle}</h3>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          [t.common.download, `${formatMbps(locale, result.down)} ${t.units.mbps}`],
          [t.common.upload, `${formatMbps(locale, result.up)} ${t.units.mbps}`],
          [t.speedTest.latencyLabel, result.latency !== null ? `${Math.round(result.latency)} ${t.units.ms}` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface-2/70 p-2">
            <dt className="text-[11px] text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className={`flex items-center gap-2 rounded-md p-3 text-sm ${meets ? "bg-good/10 text-good" : "bg-warn/10 text-warn"}`}>
        {meets ? <CheckCircle2 className="size-4" aria-hidden /> : <TriangleAlert className="size-4" aria-hidden />}
        <span>
          <strong>{meets ? t.speedTest.meets : t.speedTest.below}.</strong> {t.speedTest.vsTarget}
        </span>
      </p>
      <p className="text-xs text-muted">{t.speedTest.singleStream}</p>
      <button type="button" onClick={onAgain} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
        <RotateCcw className="size-4" aria-hidden /> {t.speedTest.again}
      </button>
    </div>
  );
}

function ShareForm({ result, t, locale }: { result: Result; t: Messages; locale: Locale }) {
  const [location, setLocation] = useState<Location | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "busy" | "denied">("idle");
  const [isps, setIsps] = useState<{ id: number; name: string }[]>([]);
  const [isp, setIsp] = useState<string>("");
  const [ispOther, setIspOther] = useState("");
  const [conn, setConn] = useState<string>("");
  const [planDown, setPlanDown] = useState("");
  const [planUp, setPlanUp] = useState("");
  const [price, setPrice] = useState("");
  const [wired, setWired] = useState<"" | "yes" | "no">("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ rank: number | null; name: string | null; regionId: string | null } | null>(null);
  const submittedFor = useRef<string | null>(null);
  const onToken = useCallback((tok: string | null) => setToken(tok), []);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m: { isps: { id: number; name: string }[] }) => setIsps(m.isps))
      .catch(() => {});
  }, []);

  const useGps = () => {
    if (!("geolocation" in navigator)) return setGeoState("denied");
    setGeoState("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        // rounded to ~100 m before it ever leaves the browser
        setLocation({ type: "gps", lat: Math.round(p.coords.latitude * 1000) / 1000, lon: Math.round(p.coords.longitude * 1000) / 1000 });
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return setMessage(t.speedTest.errors.needLocation);
    const key = `${result.uuidDown}`;
    if (submittedFor.current === key) return;
    setStatus("sending");
    setMessage(null);
    const body = {
      downMbps: Math.round(result.down * 100) / 100,
      upMbps: Math.round(result.up * 100) / 100,
      latencyMs: result.latency,
      uuidDown: result.uuidDown,
      uuidUp: result.uuidUp,
      location: location.type === "gps" ? { type: "gps", lat: location.lat, lon: location.lon } : { type: "search", regionId: location.regionId },
      survey: {
        ispId: isp && isp !== "other" ? Number(isp) : null,
        ispOther: isp === "other" ? ispOther.trim() || null : null,
        connectionType: conn || null,
        planDownMbps: num(planDown),
        planUpMbps: num(planUp),
        monthlyPrice: num(price),
        wired: wired === "" ? null : wired === "yes",
      },
      locale,
      turnstileToken: token ?? undefined,
    };
    try {
      const res = await fetch("/api/tests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        submittedFor.current = key;
        setStatus("done");
        setDone({ rank: json.rank ?? null, name: json.area?.name ?? null, regionId: json.area?.regionId ?? null });
        return;
      }
      const map: Record<string, string> = {
        outside_canada: t.speedTest.errors.outside,
        rate_limited: t.speedTest.errors.rate,
        duplicate: t.speedTest.errors.duplicate,
        captcha: t.speedTest.errors.captcha,
      };
      setMessage(map[json.error] ?? t.speedTest.errors.generic);
      setStatus("error");
    } catch {
      setMessage(t.speedTest.errors.generic);
      setStatus("error");
    }
  };

  if (status === "done" && done) {
    const level = done.regionId?.split(":")[0];
    const mapHref = done.regionId ? `${localePath(locale, "home")}?l=${level}&r=${encodeURIComponent(done.regionId)}` : localePath(locale, "home");
    return (
      <div className="mt-6 space-y-3" role="status">
        <p className="flex items-center gap-2 font-semibold text-good">
          <CheckCircle2 className="size-5" aria-hidden /> {t.speedTest.thanks}
        </p>
        {done.name && (
          <p className="text-sm">
            {done.rank !== null ? fmt(t.speedTest.rank, { pct: done.rank, place: done.name }) : fmt(t.speedTest.noRank, { place: done.name })}
          </p>
        )}
        <Link href={mapHref} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-contrast">
          <MapPin className="size-4" aria-hidden /> {t.speedTest.seeMap}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t.speedTest.location}</legend>
        {location ? (
          <p className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2/60 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-brand" aria-hidden />
              {location.type === "search" ? fmt(t.speedTest.locationSet, { name: location.name }) : `✓ ${t.speedTest.useLocation}`}
            </span>
            <button type="button" className="text-xs underline" onClick={() => setLocation(null)}>
              {t.speedTest.change}
            </button>
          </p>
        ) : (
          <>
            <button type="button" onClick={useGps} disabled={geoState === "busy"} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-60">
              <LocateFixed className="size-4" aria-hidden /> {geoState === "busy" ? t.speedTest.locating : t.speedTest.useLocation}
            </button>
            {geoState === "denied" && <p className="text-xs text-warn">{t.speedTest.locationDenied}</p>}
            <p className="text-xs text-muted">{t.speedTest.orSearch}</p>
            <RegionSearch t={t} locale={locale} levels={["csd", "cd"]} onPick={(r) => setLocation({ type: "search", regionId: r.id, name: locale === "fr" ? r.nameFr : r.nameEn })} />
          </>
        )}
        <p className="text-xs text-muted">{t.speedTest.locationNote}</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t.speedTest.survey}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="s-isp" className={labelCls}>
              {t.speedTest.isp}
            </label>
            <select id="s-isp" className={inputCls} value={isp} onChange={(e) => setIsp(e.target.value)}>
              <option value="">—</option>
              {isps.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
              <option value="other">{t.speedTest.other}</option>
            </select>
          </div>
          {isp === "other" && (
            <div>
              <label htmlFor="s-isp-other" className={labelCls}>
                {t.speedTest.ispOther}
              </label>
              <input id="s-isp-other" className={inputCls} maxLength={80} value={ispOther} onChange={(e) => setIspOther(e.target.value)} />
            </div>
          )}
          <div>
            <label htmlFor="s-conn" className={labelCls}>
              {t.speedTest.connectionType}
            </label>
            <select id="s-conn" className={inputCls} value={conn} onChange={(e) => setConn(e.target.value)}>
              <option value="">—</option>
              {CONNECTION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t.tech[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="s-pd" className={labelCls}>
              {t.speedTest.planDown}
            </label>
            <input id="s-pd" className={inputCls} inputMode="decimal" type="number" min={0} max={50000} step="any" value={planDown} onChange={(e) => setPlanDown(e.target.value)} />
          </div>
          <div>
            <label htmlFor="s-pu" className={labelCls}>
              {t.speedTest.planUp}
            </label>
            <input id="s-pu" className={inputCls} inputMode="decimal" type="number" min={0} max={50000} step="any" value={planUp} onChange={(e) => setPlanUp(e.target.value)} />
          </div>
          <div>
            <label htmlFor="s-price" className={labelCls}>
              {t.speedTest.price}
            </label>
            <input id="s-price" className={inputCls} inputMode="decimal" type="number" min={0} max={9999} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <div role="radiogroup" aria-labelledby="s-wired-l">
          <p id="s-wired-l" className={labelCls}>
            {t.speedTest.wired}
          </p>
          <div className="flex gap-4 text-sm">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="wired" className="accent-[var(--brand)]" checked={wired === v} onChange={() => setWired(v)} />
                {v === "yes" ? t.speedTest.wiredYes : t.speedTest.wiredNo}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <Turnstile onToken={onToken} locale={locale} />
      {message && (
        <p className="text-sm text-danger" role="alert">
          {message}
        </p>
      )}
      <button type="submit" disabled={status === "sending"} className="w-full rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-contrast shadow-card disabled:opacity-60">
        {status === "sending" ? t.speedTest.submitting : t.speedTest.submit}
      </button>
    </form>
  );
}
