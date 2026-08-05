import { createLocalGeocodingProvider } from "./localProvider";
import type { GeocodingProvider } from "./types";

export type { GeocodeCandidate, GeocodeMatchKind, GeocodingProvider, NearbyZip } from "./types";
export { bearingForDirectionWord, destinationPoint, haversineMiles } from "./distance";

let provider: GeocodingProvider | null = null;

/**
 * Returns the active geocoding provider. `GEOCODING_PROVIDER` selects it
 * (defaults to the built-in zip-reference provider, which needs no API key).
 * Add a case here to plug in Mapbox/Google/etc. later — nothing else in the
 * app should import a provider-specific SDK directly.
 */
export function getGeocodingProvider(): GeocodingProvider {
  if (provider) return provider;
  const selected = (process.env.GEOCODING_PROVIDER ?? "local").toLowerCase();
  if (selected !== "local") {
    console.warn(
      `[geocoding] GEOCODING_PROVIDER="${selected}" is not implemented yet — falling back to the ` +
        "built-in zip-reference provider. Implement lib/geocoding/types.ts#GeocodingProvider and " +
        "wire it in here to add a real provider.",
    );
  }
  provider = createLocalGeocodingProvider();
  return provider;
}
