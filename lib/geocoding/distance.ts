const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in miles. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Destination point given a start coordinate, compass bearing (degrees,
 * 0 = north, 90 = east), and distance in miles. Used to resolve follow-up
 * chat requests like "search 15 miles north" relative to the last result.
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDegrees: number,
  distanceMiles: number,
): { latitude: number; longitude: number } {
  const angularDistance = distanceMiles / EARTH_RADIUS_MILES;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(lat);
  const lon1 = toRadians(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

/** Compass direction word/abbreviation → bearing in degrees. */
const COMPASS_BEARINGS: Record<string, number> = {
  north: 0,
  n: 0,
  northeast: 45,
  ne: 45,
  east: 90,
  e: 90,
  southeast: 135,
  se: 135,
  south: 180,
  s: 180,
  southwest: 225,
  sw: 225,
  west: 270,
  w: 270,
  northwest: 315,
  nw: 315,
};

export function bearingForDirectionWord(word: string): number | null {
  return COMPASS_BEARINGS[word.toLowerCase()] ?? null;
}
