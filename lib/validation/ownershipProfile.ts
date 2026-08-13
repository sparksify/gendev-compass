import { z } from "zod";
import {
  ACTIVITY_OPTIONS,
  ACTIVITY_SELECTION_LIMIT,
  ENVIRONMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GROWTH_COMFORT_OPTIONS,
  MOTIVATION_OPTIONS,
  OWNERSHIP_PROFILE_SECTION_COUNT,
  PRIORITY_OPTIONS,
  PRIORITY_SELECTION_LIMIT,
  TIMELINE_OPTIONS,
} from "@/types/ownershipProfile";

/**
 * Server-side validation for autosaved Ownership Profile answers.
 *
 * Every field is optional-but-bounded rather than required: the profile is
 * saved progressively, so a partial payload is the normal case, not an
 * error. What is not tolerated is an unknown option value or an oversized
 * array — those are rejected outright rather than stored.
 *
 * Selection limits are enforced here as well as in the UI, since the UI's
 * limit is a convenience and this is the boundary that actually matters.
 */

/**
 * Generic over the value type so z.enum keeps the literal union rather than
 * widening to string — that union is what makes the parsed payload directly
 * assignable to OwnershipProfileInput.
 */
function optionValues<V extends string>(options: ReadonlyArray<{ value: V }>): [V, ...V[]] {
  return options.map((option) => option.value) as [V, ...V[]];
}

export const ownershipProfileSchema = z.object({
  motivations: z.array(z.enum(optionValues(MOTIVATION_OPTIONS))).max(MOTIVATION_OPTIONS.length).default([]),
  activities: z.array(z.enum(optionValues(ACTIVITY_OPTIONS))).max(ACTIVITY_SELECTION_LIMIT).default([]),
  ownershipStyle: z.number().int().min(0).max(100).default(50),
  growthComfort: z.enum(optionValues(GROWTH_COMFORT_OPTIONS)).nullable().default(null),
  environments: z.array(z.enum(optionValues(ENVIRONMENT_OPTIONS))).max(ENVIRONMENT_OPTIONS.length).default([]),
  priorities: z.array(z.enum(optionValues(PRIORITY_OPTIONS))).max(PRIORITY_SELECTION_LIMIT).default([]),
  experience: z.array(z.enum(optionValues(EXPERIENCE_OPTIONS))).max(EXPERIENCE_OPTIONS.length).default([]),
  timeline: z.enum(optionValues(TIMELINE_OPTIONS)).nullable().default(null),
  currentStep: z.number().int().min(0).max(OWNERSHIP_PROFILE_SECTION_COUNT).default(0),
  /**
   * The client asserts completion; the server decides whether that is a
   * *new* completion (see the route). It is a boolean rather than a
   * timestamp so the client cannot backdate or forge the completion time.
   */
  completed: z.boolean().default(false),
});

export type OwnershipProfilePayload = z.infer<typeof ownershipProfileSchema>;
