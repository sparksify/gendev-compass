import { getStore } from "@/lib/store";
import type { ZipCodeReferenceRecord } from "@/types/territory";
import { haversineMiles } from "./distance";
import { normalizeStateToken } from "./states";
import type { GeocodeCandidate, GeocodingProvider, NearbyZip } from "./types";

/**
 * Default, dependency-free geocoding provider backed by the seeded
 * `zip_code_reference` table. No external API key required — matches the
 * rest of this app's "everything has a dev fallback" philosophy. Swap in a
 * real provider (Mapbox/Google) later by implementing the same interface;
 * see lib/geocoding/index.ts for the selection point.
 */

/** Informal/neighborhood names that don't appear as a city in census data. */
const LOCATION_ALIASES: Record<string, { zip: string; label: string }> = {
  "north dallas": { zip: "75230", label: "North Dallas, TX" },
  "downtown dallas": { zip: "75201", label: "Downtown Dallas, TX" },
  "east dallas": { zip: "75214", label: "East Dallas, TX" },
  "uptown dallas": { zip: "75204", label: "Uptown Dallas, TX" },
  dfw: { zip: "75201", label: "Dallas–Fort Worth, TX" },
  "downtown nashville": { zip: "37201", label: "Downtown Nashville, TN" },
  "east nashville": { zip: "37206", label: "East Nashville, TN" },
};

function toZipCandidate(row: ZipCodeReferenceRecord, label?: string): GeocodeCandidate {
  return {
    kind: "zip",
    label: label ?? `${row.city}, ${row.state_code} ${row.zip_code}`,
    city: row.city,
    stateCode: row.state_code,
    zipCode: row.zip_code,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/** Splits "City, ST" / "City ST" / "City" into a city guess and an optional state code. */
function splitCityState(query: string): { city: string; stateCode: string | null } {
  const commaSplit = query.split(",");
  if (commaSplit.length >= 2) {
    const city = commaSplit.slice(0, -1).join(",").trim();
    const stateCode = normalizeStateToken(commaSplit[commaSplit.length - 1]);
    if (stateCode) return { city, stateCode };
  }
  const tokens = query.trim().split(/\s+/);
  if (tokens.length >= 2) {
    const lastToken = tokens[tokens.length - 1];
    const stateCode = normalizeStateToken(lastToken);
    if (stateCode) return { city: tokens.slice(0, -1).join(" "), stateCode };
    // Try a two-word state name at the end (e.g. "... New York", "... North Carolina").
    if (tokens.length >= 3) {
      const lastTwo = tokens.slice(-2).join(" ");
      const stateCode2 = normalizeStateToken(lastTwo);
      if (stateCode2) return { city: tokens.slice(0, -2).join(" "), stateCode: stateCode2 };
    }
  }
  return { city: query.trim(), stateCode: null };
}

function cityCentroid(rows: ZipCodeReferenceRecord[]): { latitude: number; longitude: number } {
  const lat = rows.reduce((sum, r) => sum + r.latitude, 0) / rows.length;
  const lng = rows.reduce((sum, r) => sum + r.longitude, 0) / rows.length;
  return { latitude: lat, longitude: lng };
}

/** Picks the zip with the largest population as the representative "primary" zip for a city. */
function primaryZip(rows: ZipCodeReferenceRecord[]): ZipCodeReferenceRecord {
  return [...rows].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
}

export function createLocalGeocodingProvider(): GeocodingProvider {
  return {
    async geocode(rawQuery: string): Promise<GeocodeCandidate[]> {
      const query = rawQuery.trim();
      if (!query) return [];

      // 1. Exact ZIP code.
      const zipMatch = query.match(/^\d{5}$/);
      if (zipMatch) {
        const row = await getStore().getZipCodeReference(query);
        return row ? [toZipCandidate(row)] : [];
      }

      // 2. Known informal/neighborhood alias.
      const alias = LOCATION_ALIASES[query.toLowerCase()];
      if (alias) {
        const row = await getStore().getZipCodeReference(alias.zip);
        if (row) return [toZipCandidate(row, alias.label)];
      }

      const allZips = await getStore().listZipCodeReferences();

      // 3. "City, ST" / "City ST".
      const { city, stateCode } = splitCityState(query);
      if (city && stateCode) {
        const matches = allZips.filter(
          (z) => z.city.toLowerCase() === city.toLowerCase() && z.state_code === stateCode,
        );
        if (matches.length > 0) {
          const centroid = cityCentroid(matches);
          const primary = primaryZip(matches);
          return [
            {
              kind: "city",
              label: `${primary.city}, ${primary.state_code}`,
              city: primary.city,
              stateCode: primary.state_code,
              zipCode: primary.zip_code,
              latitude: centroid.latitude,
              longitude: centroid.longitude,
            },
          ];
        }
      }

      // 4. Bare city name — may be ambiguous across states.
      const cityOnlyMatches = allZips.filter((z) => z.city.toLowerCase() === query.toLowerCase());
      if (cityOnlyMatches.length > 0) {
        const byState = new Map<string, ZipCodeReferenceRecord[]>();
        for (const row of cityOnlyMatches) {
          const list = byState.get(row.state_code) ?? [];
          list.push(row);
          byState.set(row.state_code, list);
        }
        return [...byState.entries()].map(([stCode, rows]) => {
          const centroid = cityCentroid(rows);
          const primary = primaryZip(rows);
          return {
            kind: "city" as const,
            label: `${primary.city}, ${stCode}`,
            city: primary.city,
            stateCode: stCode,
            zipCode: primary.zip_code,
            latitude: centroid.latitude,
            longitude: centroid.longitude,
          };
        });
      }

      // 5. Bare state name/abbreviation — broad, state-level candidate.
      const bareState = normalizeStateToken(query);
      if (bareState) {
        const rowsInState = allZips.filter((z) => z.state_code === bareState);
        if (rowsInState.length > 0) {
          const centroid = cityCentroid(rowsInState);
          return [
            {
              kind: "state",
              label: query,
              city: null,
              stateCode: bareState,
              zipCode: null,
              latitude: centroid.latitude,
              longitude: centroid.longitude,
            },
          ];
        }
        // State recognized but we have no reference data for it at all.
        return [];
      }

      return [];
    },

    async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeCandidate | null> {
      const allZips = await getStore().listZipCodeReferences();
      let nearest: { row: ZipCodeReferenceRecord; distance: number } | null = null;
      for (const row of allZips) {
        const distance = haversineMiles(latitude, longitude, row.latitude, row.longitude);
        if (!nearest || distance < nearest.distance) nearest = { row, distance };
      }
      if (!nearest || nearest.distance > 50) return null;
      return toZipCandidate(nearest.row);
    },

    async findNearbyZipCodes(
      latitude: number,
      longitude: number,
      radiusMiles: number,
    ): Promise<NearbyZip[]> {
      const allZips = await getStore().listZipCodeReferences();
      return allZips
        .map((row) => ({
          zipCode: row.zip_code,
          city: row.city,
          stateCode: row.state_code,
          latitude: row.latitude,
          longitude: row.longitude,
          distanceMiles: haversineMiles(latitude, longitude, row.latitude, row.longitude),
          population: row.population,
          households: row.households,
          medianHouseholdIncome: row.median_household_income,
        }))
        .filter((z) => z.distanceMiles <= radiusMiles)
        .sort((a, b) => a.distanceMiles - b.distanceMiles);
    },
  };
}
