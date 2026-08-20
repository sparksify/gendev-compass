import { z } from "zod";
import { RADIUS_OPTIONS_MILES } from "@/lib/config/territory";

export const territorySearchSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    radiusMiles: z
      .number()
      .refine((v) => (RADIUS_OPTIONS_MILES as readonly number[]).includes(v), { message: "Invalid radius" })
      .optional(),
    /** Used only by the "Use my current city" affordance — bypasses text geocoding. */
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    /** Analytics-only hint for how this query originated. */
    origin: z.enum(["text", "chip", "alternative", "candidate", "current_location"]).optional(),
  })
  .refine((data) => (data.query && data.query.length > 0) || (data.latitude != null && data.longitude != null), {
    message: "Enter a city, ZIP code, or market",
    path: ["query"],
  });
export type TerritorySearchPayload = z.infer<typeof territorySearchSchema>;

export const territoryReviewRequestSchema = z.object({
  territorySearchId: z.string().trim().min(1).max(100).optional(),
  message: z.string().trim().max(2000).optional(),
});
export type TerritoryReviewRequestPayload = z.infer<typeof territoryReviewRequestSchema>;

export const stateEligibilityUpsertSchema = z.object({
  stateCode: z.string().trim().length(2),
  status: z.enum(["approved", "pending", "not_registered", "exempt", "restricted", "manual_review"]),
  effectiveDate: z.string().trim().max(40).optional().nullable(),
  expirationDate: z.string().trim().max(40).optional().nullable(),
  notesInternal: z.string().trim().max(2000).optional().nullable(),
});
export type StateEligibilityUpsertPayload = z.infer<typeof stateEligibilityUpsertSchema>;

export const bulkStateEligibilitySchema = z.object({
  rows: z.array(stateEligibilityUpsertSchema).min(1).max(60),
});

export const territoryDefinitionSchema = z.object({
  territoryName: z.string().trim().min(1).max(200),
  territoryCode: z.string().trim().max(60).optional().nullable(),
  definitionType: z.enum(["zip_list", "radius", "county", "polygon", "manual"]),
  status: z.enum(["available", "reserved", "sold", "corporate", "unavailable", "pending", "archived"]),
  centerLatitude: z.number().min(-90).max(90).optional().nullable(),
  centerLongitude: z.number().min(-180).max(180).optional().nullable(),
  radiusMiles: z.number().positive().max(500).optional().nullable(),
  publicDisplayLevel: z.enum(["hidden", "generalized", "exact"]).optional(),
  internalNotes: z.string().trim().max(4000).optional().nullable(),
  awardedAt: z.string().trim().max(40).optional().nullable(),
  reservedUntil: z.string().trim().max(40).optional().nullable(),
});
export type TerritoryDefinitionPayload = z.infer<typeof territoryDefinitionSchema>;

/** Confirmation payload for the "Upload Territory Report" flow (sent as
 *  the `payload` field of a multipart request alongside the source PDF —
 *  see app/api/advisor/territories/reports/confirm). */
export const territoryReportConfirmSchema = z.object({
  brandId: z.string().trim().min(1),
  territoryName: z.string().trim().min(1).max(200),
  territoryCode: z.string().trim().max(60).optional().nullable(),
  status: z.enum(["available", "reserved", "sold", "corporate", "unavailable", "pending", "archived"]),
  publicDisplayLevel: z.enum(["hidden", "generalized", "exact"]).optional(),
  internalNotes: z.string().trim().max(4000).optional().nullable(),
  zipCodes: z
    .array(z.string().trim().regex(/^\d{5}$/, "Each ZIP must be 5 digits"))
    .min(1)
    .max(2000),
});
export type TerritoryReportConfirmPayload = z.infer<typeof territoryReportConfirmSchema>;

export const addZipCodesSchema = z.object({
  zipCodes: z
    .array(z.string().trim().regex(/^\d{5}$/, "Each ZIP must be 5 digits"))
    .min(1)
    .max(2000),
});

export const reviewRequestUpdateSchema = z.object({
  status: z.enum(["new", "in_review", "contacted", "approved", "declined", "closed"]).optional(),
  assignedTo: z.string().trim().max(100).optional().nullable(),
  internalNotes: z.string().trim().max(4000).optional().nullable(),
});
