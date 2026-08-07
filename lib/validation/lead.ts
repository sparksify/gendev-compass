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
  // Attribution — first touch (spec §4). Optional; every existing caller
  // keeps working unchanged. landingPage/referrer are typically supplied by
  // the ad platform's or CRM's lead-capture form, which has the browser
  // context this server-to-server call does not.
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  fbclid: z.string().trim().max(500).optional(),
  gclid: z.string().trim().max(500).optional(),
  msclkid: z.string().trim().max(500).optional(),
  fbp: z.string().trim().max(200).optional(),
  fbc: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(2000).optional(),
  landingPage: z.string().trim().max(2000).optional(),
  // Facebook Lead Ads extended attribution (spec §5) — populated via CRM
  // automation today; a direct Lead Ads webhook is a future extension point.
  facebookCampaignId: z.string().trim().max(200).optional(),
  facebookAdsetId: z.string().trim().max(200).optional(),
  facebookAdId: z.string().trim().max(200).optional(),
  facebookFormId: z.string().trim().max(200).optional(),
  facebookPageId: z.string().trim().max(200).optional(),
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;
