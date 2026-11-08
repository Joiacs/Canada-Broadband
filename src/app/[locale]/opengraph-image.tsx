import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n/dictionary";

export const alt = "Canada Broadband, by Ideva";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = `data:image/png;base64,${(await readFile(join(process.cwd(), "public", "ideva-bulb.png"))).toString("base64")}`;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale === "fr" ? "fr" : "en");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0c111b 0%, #1d1648 100%)", color: "#e8ecf4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={mark} width={84} height={84} alt="" />
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ fontSize: 44, fontWeight: 700 }}>{t.meta.siteName}</div>
            <div style={{ fontSize: 26, color: "#9aa5b8" }}>{t.meta.by}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>{t.map.title}</div>
          <div style={{ fontSize: 30, color: "#9aa5b8" }}>{`${t.common.target}${locale === "fr" ? " : " : ": "}${t.common.targetValue}`}</div>
        </div>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>
          {["#ffffcc", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"].map((c) => (
            <div key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
