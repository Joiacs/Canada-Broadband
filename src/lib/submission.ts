import { z } from "zod";

const uuid = z.string().min(8).max(128).regex(/^[A-Za-z0-9_\-:.]+$/);
const mbps = z.number().finite().min(0).max(50000);

export const CONNECTION_TYPES = ["fibre", "cable", "dsl", "fixed_wireless", "satellite_leo", "satellite_geo", "mobile", "other", "unknown"] as const;

export const submissionSchema = z.object({
  downMbps: mbps,
  upMbps: mbps,
  latencyMs: z.number().finite().min(0).max(60000).nullable().optional(),
  uuidDown: uuid.nullable().optional(),
  uuidUp: uuid.nullable().optional(),
  location: z.discriminatedUnion("type", [
    // Coordinates are used once to look up areas, then discarded.
    z.object({ type: z.literal("gps"), lat: z.number().min(41).max(84), lon: z.number().min(-142).max(-52) }),
    z.object({ type: z.literal("search"), regionId: z.string().regex(/^(pr|cd|csd):[0-9]{2,8}$/) }),
  ]),
  survey: z
    .object({
      ispId: z.number().int().positive().nullable().optional(),
      ispOther: z.string().trim().max(80).nullable().optional(),
      connectionType: z.enum(CONNECTION_TYPES).nullable().optional(),
      planDownMbps: mbps.nullable().optional(),
      planUpMbps: mbps.nullable().optional(),
      monthlyPrice: z.number().finite().min(0).max(9999).nullable().optional(),
      wired: z.boolean().nullable().optional(),
    })
    .default({}),
  locale: z.enum(["en", "fr"]).default("en"),
  turnstileToken: z.string().max(4096).optional(),
});

export type Submission = z.infer<typeof submissionSchema>;
