import { z } from "zod";

export const startActivationSchema = z.object({
  brandSlug: z.string().trim().min(1).max(100),
  formId: z.string().trim().max(200).optional(),
  campaignId: z.string().trim().max(200).optional(),
  adId: z.string().trim().max(200).optional(),
  pageId: z.string().trim().max(200).optional(),
  source: z.string().trim().max(100).optional(),
});

export const phoneLastFourSchema = z.object({
  phoneLastFour: z.string().regex(/^\d{4}$/, "Must be exactly four digits"),
});

export const highLevelFacebookLeadSchema = z.object({
  contactId: z.string().trim().min(1).max(200),
  locationId: z.string().trim().min(1).max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().max(320).optional(),
  phone: z.string().trim().max(30).optional(),
  brandSlug: z.string().trim().min(1).max(100),
  advisorId: z.string().trim().max(200).optional(),
  source: z.string().trim().max(100).optional(),
  facebookPageId: z.string().trim().max(200).optional(),
  facebookFormId: z.string().trim().max(200).optional(),
  facebookCampaignId: z.string().trim().max(200).optional(),
  facebookAdId: z.string().trim().max(200).optional(),
  submittedAt: z.string().trim().max(60).optional(),
});

export type StartActivationPayload = z.infer<typeof startActivationSchema>;
export type PhoneLastFourPayload = z.infer<typeof phoneLastFourSchema>;
export type HighLevelFacebookLeadPayload = z.infer<typeof highLevelFacebookLeadSchema>;
