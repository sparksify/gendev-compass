import { z } from "zod";

export const createLeadSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(30).optional(),
  state: z.string().trim().max(100).optional(),
  liquidCapital: z.string().trim().max(100).optional(),
  netWorth: z.string().trim().max(100).optional(),
  ownedBusinessBefore: z.boolean().optional(),
  source: z.string().trim().max(100).optional(),
  campaign: z.string().trim().max(200).optional(),
  adSet: z.string().trim().max(200).optional(),
  ad: z.string().trim().max(200).optional(),
  facebookLeadId: z.string().trim().max(100).optional(),
  // Future-ready platform fields — all optional; existing callers that send
  // only the fields above keep working unchanged. Slugs are resolved (never
  // trusted as IDs) and unknown values fall back to the deployment default.
  organizationSlug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and dashes only")
    .optional(),
  brandSlug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and dashes only")
    .optional(),
  assignedAdvisorId: z.string().uuid().optional(),
  externalContactId: z.string().trim().min(1).max(200).optional(),
  externalOpportunityId: z.string().trim().min(1).max(200).optional(),
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;
