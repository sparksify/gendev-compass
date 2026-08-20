import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import type { LeadRecord } from "@/types/lead";

export const dynamic = "force-dynamic";

/**
 * Hand-off endpoint for the Facebook lead ad's static "View website" button
 * (the /start page). Facebook cannot inject a per-lead URL into the thank-you
 * screen, and the lead itself arrives asynchronously (Facebook → automation →
 * POST /api/leads), so /start polls GET here until the freshly created lead
 * shows up, confirms the visitor's identity by first name, and only then
 * releases the portal link via POST.
 *
 * A lead is a hand-off candidate while it is recent (created within
 * CANDIDATE_WINDOW_MS), its portal has never been opened, and no
 * "start_claimed" event has been recorded for it. Two prospects submitting
 * near-simultaneously therefore cannot receive the same portal: the first
 * confirmed claim writes start_claimed, and the loser of the race falls back
 * to the email lookup.
 *
 * Deliberate disclosure trade-offs (MVP): GET exposes the newest unclaimed
 * lead's first name (needed for the "You're {name}, right?" confirmation),
 * and the email lookup returns the portal link for an address the caller
 * already knows — the same link that address receives by email anyway. Both
 * are rate limited per IP.
 */

const CANDIDATE_WINDOW_MS = 10 * 60_000;
const EMAIL_LOOKUP_WINDOW_MS = 48 * 3_600_000;

function isCandidate(lead: LeadRecord, now: number): boolean {
  if (lead.portal_first_opened_at) return false;
  const createdAt = Date.parse(lead.created_at);
  return Number.isFinite(createdAt) && now - createdAt <= CANDIDATE_WINDOW_MS;
}

async function hasClaimEvent(leadId: string): Promise<boolean> {
  const events = await getStore().getEventsForLead(leadId);
  return events.some((event) => event.event_name === "start_claimed");
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!rateLimit(`start:poll:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ found: false, error: "rate_limited" }, { status: 429 });
  }

  // Leads this visitor already rejected with "That's not me" — skipped so the
  // page can keep polling for the visitor's own (possibly still in-flight)
  // lead instead of re-offering the same wrong one.
  const excluded = new Set(
    (new URL(request.url).searchParams.get("exclude") ?? "").split(",").filter(Boolean),
  );

  try {
    const now = Date.now();
    const candidates = (await getStore().listLeads())
      .filter((lead) => isCandidate(lead, now) && !excluded.has(lead.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    for (const lead of candidates) {
      if (await hasClaimEvent(lead.id)) continue;
      return NextResponse.json({
        found: true,
        candidateId: lead.id,
        firstName: lead.first_name,
      });
    }
    return NextResponse.json({ found: false });
  } catch (error) {
    console.error("[start] candidate lookup failed:", error);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`start:claim:${clientIpFrom(request)}`, 10, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: { candidateId?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (typeof body.candidateId === "string" && body.candidateId) {
      return await claimCandidate(body.candidateId);
    }
    if (typeof body.email === "string" && body.email) {
      return await lookupByEmail(body.email);
    }
    return NextResponse.json(
      { success: false, error: "candidateId or email is required" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[start] claim failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/** Confirmed "Yes, that's me" on the /start page. */
async function claimCandidate(candidateId: string): Promise<NextResponse> {
  const lead = await getStore().getLeadById(candidateId);
  if (!lead || !isCandidate(lead, Date.now()) || (await hasClaimEvent(lead.id))) {
    // Claimed by someone else, expired, or bogus id — the page falls back to
    // the email lookup.
    return NextResponse.json({ success: false, error: "not_available" }, { status: 409 });
  }

  await trackEvent(lead, "start_claimed", { via: "confirm" }, "/start");
  return NextResponse.json({ success: true, portalUrl: `/p/${lead.portal_token}` });
}

/** "That's not me" / timeout fallback: find the lead by its form email. */
async function lookupByEmail(rawEmail: string): Promise<NextResponse> {
  const email = rawEmail.trim().toLowerCase();
  const now = Date.now();

  // listLeads + filter instead of getLeadByEmail: duplicates are separate
  // records and getLeadByEmail returns the oldest — here the newest recent
  // submission is the one the visitor just made.
  const match = (await getStore().listLeads())
    .filter((lead) => {
      if (lead.email.toLowerCase() !== email) return false;
      const createdAt = Date.parse(lead.created_at);
      return Number.isFinite(createdAt) && now - createdAt <= EMAIL_LOOKUP_WINDOW_MS;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  if (!match) {
    return NextResponse.json(
      {
        success: false,
        error:
          "We couldn't find a recent submission for that email. It can take a minute to arrive — please try again, or use the link we sent to your email.",
      },
      { status: 404 },
    );
  }

  await trackEvent(match, "start_claimed", { via: "email" }, "/start");
  return NextResponse.json({ success: true, portalUrl: `/p/${match.portal_token}` });
}
