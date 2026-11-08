import { describe, expect, it } from "vitest";
import { colorFor, scaleFor, SEQ } from "@/components/map/scales";
import { effectiveQuery, statsQuery } from "@/lib/params";
import { submissionSchema } from "@/lib/submission";
import { parseCsvLine } from "../../pipeline/lib/csv";

describe("stats query", () => {
  it("accepts a normal query and applies defaults", () => {
    const q = statsQuery.parse({ from: "2026-08-01", to: "2026-10-31" });
    expect(q).toMatchObject({ level: "pr", direction: "down", source: "all", isp: 0 });
  });
  it("rejects reversed or huge ranges and bad levels", () => {
    expect(statsQuery.safeParse({ from: "2026-10-01", to: "2026-01-01" }).success).toBe(false);
    expect(statsQuery.safeParse({ from: "2019-01-01", to: "2026-01-01" }).success).toBe(false);
    expect(statsQuery.safeParse({ level: "street", from: "2026-01-01", to: "2026-02-01" }).success).toBe(false);
  });
  it("hexagons only use community data and never ISP rows", () => {
    const q = effectiveQuery(statsQuery.parse({ level: "hex", source: "mlab", isp: 3, from: "2026-01-01", to: "2026-02-01" }));
    expect(q.source).toBe("community");
    expect(q.isp).toBe(0);
  });
});

describe("submission", () => {
  const base = { downMbps: 80, upMbps: 12, location: { type: "gps", lat: 45.4, lon: -75.7 } };
  it("accepts a minimal valid submission", () => {
    expect(submissionSchema.safeParse(base).success).toBe(true);
  });
  it("rejects coordinates outside Canada's bounding box and negative speeds", () => {
    expect(submissionSchema.safeParse({ ...base, location: { type: "gps", lat: 10, lon: 10 } }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...base, downMbps: -1 }).success).toBe(false);
  });
  it("only allows province/division/community ids for searched locations", () => {
    expect(submissionSchema.safeParse({ ...base, location: { type: "search", regionId: "csd:3520005" } }).success).toBe(true);
    expect(submissionSchema.safeParse({ ...base, location: { type: "search", regionId: "hex:ON1'; drop" } }).success).toBe(false);
  });
});

describe("colour scales", () => {
  it("places the 50 Mbps target at a class boundary", () => {
    const s = scaleFor("median", "down");
    expect(s.breaks[s.targetIndex! - 1]).toBe(50);
    expect(colorFor(s, 49.9)).not.toBe(colorFor(s, 50));
  });
  it("returns null for missing values and clamps extremes", () => {
    const s = scaleFor("pctMeet", "down");
    expect(colorFor(s, null)).toBeNull();
    expect(colorFor(s, -5)).toBe(SEQ[0]);
    expect(colorFor(s, 100)).toBe(SEQ[6]);
  });
});

describe("ISED CSV parsing", () => {
  it("handles quotes and embedded commas", () => {
    expect(parseCsvLine('"AB1","Xplore, Inc - 12","Fixed Wireless"')).toEqual(["AB1", "Xplore, Inc - 12", "Fixed Wireless"]);
    expect(parseCsvLine('1,"a ""b""",,3')).toEqual(["1", 'a "b"', "", "3"]);
  });
});
