/**
 * Geocoding provider abstraction. All provider-specific calls (built-in
 * zip-reference lookup today; Mapbox/Google/etc. later) go through this
 * interface so nothing else in the app talks to a provider directly.
 */

export type GeocodeMatchKind = "zip" | "city" | "state";

export interface GeocodeCandidate {
  kind: GeocodeMatchKind;
  label: string;
  city: string | null;
  stateCode: string;
  zipCode: string | null;
  latitude: number;
  longitude: number;
}

export interface NearbyZip {
  zipCode: string;
  city: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  population: number | null;
  households: number | null;
  medianHouseholdIncome: number | null;
}

export interface GeocodingProvider {
  /**
   * Resolves a free-text query to zero or more candidates. Zero means
   * "not found"; more than one means the caller should ask the prospect to
   * disambiguate (e.g. a bare city name that exists in multiple states).
   */
  geocode(query: string): Promise<GeocodeCandidate[]>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodeCandidate | null>;
  findNearbyZipCodes(latitude: number, longitude: number, radiusMiles: number): Promise<NearbyZip[]>;
}
