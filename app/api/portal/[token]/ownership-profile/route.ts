import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { ownershipProfileSchema } from "@/lib/validation/ownershipProfile";
import { ensureLeadDomainChain } from "@/lib/domain/chain";
import { countAnsweredSections } from "@/types/ownershipProfile";

export const dynamic = "force-dynamic";

/**
 * Ownership Profile persistence.
 *
 * Saved progressively as the investor answers, so POST is called repeatedly
 * for one profile and is a plain upsert keyed by lead. The investor is
 * always the portal token's own lead — the payload cannot name a different
 * one — and only known option values are accepted.
 *
 * Completion is decided here, not by the client: the completion event (and
 * therefore the advisor notification) fires exactly once, on the transition
 * from unfinished to finished. The client sends a boolean, never a
 * timestamp, so it cannot forge or replay a completion.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;

  try {
    const profile = await getStore().getOwnershipProfile(resolved.lead.id);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[ownership-profile] load failed:", error);
    return NextResponse.json({ success: false, error: "Could not load profile" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  // Autosave is chatty by design; this bounds a runaway client without
  // interfering with normal use (the hook debounces to ~1 write/1.5s).
  if (!rateLimit(`ownership-profile:${clientIpFrom(request)}`, 120, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ownershipProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid profile", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const answers = parsed.data;

  try {
    const store = getStore();
    const existing = await store.getOwnershipProfile(lead.id);

    // A completion only counts the first time. Re-saving a finished profile
    // (the investor reopening the summary) must not notify again.
    const alreadyCompleted = Boolean(existing?.completed_at);
    const completingNow = answers.completed && !alreadyCompleted;
    const now = new Date().toISOString();

    // Attach to the lead's opportunity chain when available; a chain failure
    // never blocks the save.
    let chain = null;
    try {
      chain = await ensureLeadDomainChain(lead);
    } catch (error) {
      console.error(`[ownership-profile] chain resolution failed for lead ${lead.id}:`, error);
    }

    const profile = await store.upsertOwnershipProfile({
      lead_id: lead.id,
      motivations: answers.motivations,
      activities: answers.activities,
      ownership_style: answers.ownershipStyle,
      growth_comfort: answers.growthComfort,
      environments: answers.environments,
      priorities: answers.priorities,
      experience: answers.experience,
      timeline: answers.timeline,
      current_step: answers.currentStep,
      answered_sections: countAnsweredSections({
        motivations: answers.motivations,
        activities: answers.activities,
        ownershipStyle: answers.ownershipStyle,
        growthComfort: answers.growthComfort,
        environments: answers.environments,
        priorities: answers.priorities,
        experience: answers.experience,
        timeline: answers.timeline,
      }),
      ...(completingNow ? { completed_at: now } : {}),
      organization_id: chain?.organization.id ?? lead.organization_id,
      client_id: chain?.client.id ?? lead.client_id,
      opportunity_id: chain?.opportunity.id ?? lead.primary_opportunity_id,
    });

    await store.updateLead(lead.id, { last_activity_at: now });

    if (completingNow) {
      // The one event that notifies. Recorded after the save so the email
      // always renders a profile that is already durable.
      await trackEvent(lead, "ownership_profile_completed", {
        answeredSections: profile.answered_sections,
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[ownership-profile] save failed:", error);
    return NextResponse.json(
      { success: false, error: "Your profile could not be saved." },
      { status: 500 },
    );
  }
}
