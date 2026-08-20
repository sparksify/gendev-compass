import { normalizeStateToken } from "@/lib/geocoding/states";

/** U.S. Census Bureau four-region breakdown, keyed by USPS state code. */
export type UsRegion = "Northeast" | "Midwest" | "South" | "West";

const REGION_BY_STATE: Record<string, UsRegion> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast",
  VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest",
  IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest",
  ND: "Midwest", SD: "Midwest",
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South",
  VA: "South", DC: "South", WV: "South", AL: "South", KY: "South", MS: "South",
  TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West",
  UT: "West", WY: "West", AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
};

/** Resolves a state name or USPS code to its Census region; null if unrecognized. */
export function regionForState(stateToken: string | null | undefined): UsRegion | null {
  if (!stateToken) return null;
  const code = normalizeStateToken(stateToken);
  if (!code) return null;
  return REGION_BY_STATE[code] ?? null;
}

/** Approximate pin position (percent of the map's width/height) per region,
 * plotted against UsRegionMap's viewBox (960x600) — a schematic reference,
 * not precise geography. */
export const REGION_PIN_POSITION: Record<UsRegion, { x: number; y: number }> = {
  Northeast: { x: 83, y: 25 },
  Midwest: { x: 62, y: 30 },
  South: { x: 62, y: 67 },
  West: { x: 26, y: 50 },
};
