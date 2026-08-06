import { describe, expect, it } from "vitest";
import { simplifyGeometry, simplifyRing, vertexCount, type Position } from "@/lib/geo/simplify";

/** A closed square ring with dense collinear edge points. */
function denseSquare(step = 0.01): Position[] {
  const ring: Position[] = [];
  for (let x = 0; x <= 1; x += step) ring.push([x, 0]);
  for (let y = 0; y <= 1; y += step) ring.push([1, y]);
  for (let x = 1; x >= 0; x -= step) ring.push([x, 1]);
  for (let y = 1; y >= 0; y -= step) ring.push([0, y]);
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

describe("polygon simplification", () => {
  it("collapses collinear points but keeps the shape closed", () => {
    const ring = denseSquare();
    const simplified = simplifyRing(ring, 0.002);
    expect(simplified.length).toBeLessThan(ring.length / 10);
    expect(simplified.length).toBeGreaterThanOrEqual(4);
    expect(simplified[0]).toEqual(simplified[simplified.length - 1]);
  });

  it("never collapses a ring below a valid polygon", () => {
    const triangle: Position[] = [[0, 0], [1, 0], [0.5, 1], [0, 0]];
    expect(simplifyRing(triangle, 10)).toEqual(triangle);
  });

  it("simplifies Polygon and MultiPolygon geometries and counts vertices", () => {
    const polygon = { type: "Polygon" as const, coordinates: [denseSquare()] };
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [[denseSquare()], [denseSquare(0.02)]],
    };
    const simplifiedPolygon = simplifyGeometry(polygon);
    const simplifiedMulti = simplifyGeometry(multi);
    expect(vertexCount(simplifiedPolygon)).toBeLessThan(vertexCount(polygon));
    expect(vertexCount(simplifiedMulti)).toBeLessThan(vertexCount(multi));
    expect(simplifiedMulti.type).toBe("MultiPolygon");
  });

  it("drops interior rings that collapse but keeps the exterior", () => {
    const tinyHole: Position[] = [[0.5, 0.5], [0.5001, 0.5], [0.5, 0.5001], [0.5, 0.5]];
    const polygon = { type: "Polygon" as const, coordinates: [denseSquare(), tinyHole] };
    const simplified = simplifyGeometry(polygon, 0.002);
    expect(simplified.type).toBe("Polygon");
    expect((simplified.coordinates as Position[][]).length).toBe(1);
  });
});
