/**
 * Display-grade polygon simplification (Douglas–Peucker) for GeoJSON
 * geometries. Used by the polygon import pipeline to shrink Census ZCTA
 * boundaries (often thousands of vertices) to map-render weight before they
 * are stored. Pure module — no I/O — so it is unit-testable and can never
 * touch the database.
 */

export type Position = [number, number];

/** Perpendicular distance from point p to the segment a–b (degrees-space). */
function segmentDistance(p: Position, a: Position, b: Position): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function douglasPeucker(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const distance = segmentDistance(points[i], points[0], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) {
    return [points[0], points[last]];
  }
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * Simplifies one polygon ring, keeping it closed and valid (falls back to
 * the original ring if simplification would collapse it below 4 points).
 */
export function simplifyRing(ring: Position[], tolerance: number): Position[] {
  const simplified = douglasPeucker(ring, tolerance);
  if (simplified.length < 4) return ring;
  // Ensure closure (first point === last point).
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([first[0], first[1]]);
  return simplified;
}

interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: Position[][];
}

interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type GeoJsonAreaGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

/**
 * Simplifies a GeoJSON Polygon/MultiPolygon. Tiny interior rings (holes)
 * that simplify to nothing are dropped; the exterior ring is always kept.
 * Default tolerance ≈ 0.002° (~200 m) — visually crisp at city zoom while
 * cutting typical ZCTA vertex counts by >90%.
 */
export function simplifyGeometry(
  geometry: GeoJsonAreaGeometry,
  tolerance = 0.002,
): GeoJsonAreaGeometry {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates
        .map((ring, i) => (i === 0 ? simplifyRing(ring, tolerance) : douglasPeucker(ring, tolerance)))
        .filter((ring, i) => i === 0 || ring.length >= 4),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon
        .map((ring, i) => (i === 0 ? simplifyRing(ring, tolerance) : douglasPeucker(ring, tolerance)))
        .filter((ring, i) => i === 0 || ring.length >= 4),
    ),
  };
}

/** Total vertex count of a Polygon/MultiPolygon (for logging/limits). */
export function vertexCount(geometry: GeoJsonAreaGeometry): number {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  return geometry.coordinates.reduce(
    (sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0),
    0,
  );
}
