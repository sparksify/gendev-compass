import { bearingForDirectionWord, destinationPoint, getGeocodingProvider } from "@/lib/geocoding";
import { RADIUS_OPTIONS_MILES } from "@/lib/config/territory";
import type { TerritoryEvaluationResult } from "@/types/territory";

/**
 * Deterministic parsing of follow-up chat messages into a concrete next
 * evaluateTerritory() call. No LLM involved — every branch here is a plain
 * regex/string rule. If nothing matches, the whole message is treated as a
 * new location query (the most forgiving fallback), so the advisor always
 * attempts *something* deterministic rather than refusing to respond.
 */

export interface ResolvedFollowUp {
  query: string;
  radiusMiles: number;
}

export interface ShowAlternativesIntent {
  showAlternatives: true;
}

export type FollowUpResolution = ResolvedFollowUp | ShowAlternativesIntent;

const NUMBER_MILES = /(\d{1,3})\s*(?:mile|mi)s?\b/i;
const OF_LOCATION = /(?:within\s+)?\d{1,3}\s*(?:mile|mi)s?\s*(?:radius\s+)?of\s+(.+)/i;
const DIRECTION_WORD =
  /\b(north|south|east|west|northeast|northwest|southeast|southwest|ne|nw|se|sw)\b/i;
const ALTERNATIVES_PHRASE =
  /\b(nearby|other|alternative)s?\b.*\b(market|area|option|zip|town|city|cities)s?\b|what.*\b(else|other)\b.*\bopen\b/i;
const ZIP_TOKEN = /\b(\d{5})\b/;

const LEADING_FILLER =
  /^(?:please\s+)?(?:how about|what about|try|check|search for|search|look at|show me|what if it'?s?|can you check)\s+/i;
const NEAR_PHRASE = /\b(?:near|around|close to|closer to)\s+(.+)/i;
const TRAILING_FILLER = /\s+(?:instead)\.?\s*$/i;

function clampRadius(candidate: number): number {
  const nearest = RADIUS_OPTIONS_MILES.reduce((best, option) =>
    Math.abs(option - candidate) < Math.abs(best - candidate) ? option : best,
  );
  return nearest;
}

function cleanLocationText(text: string): string {
  return text
    .replace(LEADING_FILLER, "")
    .replace(TRAILING_FILLER, "")
    .replace(/[.?!]+$/, "")
    .trim();
}

/**
 * Resolves a follow-up message against the last evaluation shown to the
 * prospect. Returns either a new {query, radiusMiles} to re-evaluate, or a
 * request to surface the alternatives already computed for the last result.
 */
export async function resolveFollowUp(
  message: string,
  lastResult: TerritoryEvaluationResult | null,
): Promise<FollowUpResolution> {
  const trimmed = message.trim();
  const defaultRadius = lastResult?.evaluation.radiusMiles ?? RADIUS_OPTIONS_MILES[1];

  // "within 15 miles of Frisco" / "15 miles of Nashville"
  const ofLocationMatch = trimmed.match(OF_LOCATION);
  if (ofLocationMatch) {
    const milesMatch = trimmed.match(NUMBER_MILES);
    return {
      query: cleanLocationText(ofLocationMatch[1]),
      radiusMiles: milesMatch ? clampRadius(Number(milesMatch[1])) : defaultRadius,
    };
  }

  // "what nearby markets are open?" — reuse the last result's alternatives.
  if (ALTERNATIVES_PHRASE.test(trimmed)) {
    return { showAlternatives: true };
  }

  // "search 15 miles north" / "check 10 mi west of here" — directional shift
  // relative to the last searched center, at the requested distance.
  const directionMatch = trimmed.match(DIRECTION_WORD);
  const milesMatch = trimmed.match(NUMBER_MILES);
  if (directionMatch && milesMatch && lastResult?.location.latitude != null && lastResult.location.longitude != null) {
    const bearing = bearingForDirectionWord(directionMatch[1]);
    const distance = Number(milesMatch[1]);
    if (bearing != null && Number.isFinite(distance)) {
      const shifted = destinationPoint(lastResult.location.latitude, lastResult.location.longitude, bearing, distance);
      const nearest = await getGeocodingProvider().reverseGeocode(shifted.latitude, shifted.longitude);
      if (nearest?.zipCode) {
        return { query: nearest.zipCode, radiusMiles: defaultRadius };
      }
    }
  }

  // "increase the radius to 15 miles" / "expand to 25 miles" — radius-only
  // change, same location.
  if (milesMatch && /\b(radius|expand|widen|increase|change|use)\b/i.test(trimmed) && lastResult) {
    const zip = lastResult.location.zipCode;
    const anchor = zip ?? lastResult.location.displayName ?? lastResult.location.query;
    return { query: anchor, radiusMiles: clampRadius(Number(milesMatch[1])) };
  }

  // Bare 5-digit ZIP anywhere in the message.
  const zipToken = trimmed.match(ZIP_TOKEN);
  if (zipToken) {
    return { query: zipToken[1], radiusMiles: defaultRadius };
  }

  // "I'd prefer to stay near Dallas" / "closer to downtown"
  const nearMatch = trimmed.match(NEAR_PHRASE);
  if (nearMatch) {
    return { query: cleanLocationText(nearMatch[1]), radiusMiles: defaultRadius };
  }

  // "How about Plano instead?" / "Check 75034." / "Try Franklin"
  const cleaned = cleanLocationText(trimmed);
  return { query: cleaned || trimmed, radiusMiles: defaultRadius };
}
