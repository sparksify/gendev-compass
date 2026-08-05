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
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;
