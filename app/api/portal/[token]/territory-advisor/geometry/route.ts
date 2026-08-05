import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Display geometry for the prospect's own evaluation area: simplified
 * boundary shapes for the ZIPs inside the radius THEY searched. Carries no
 * territory information at all — no statuses, no ownership, no sold/reserved
 * boundaries (those never leave the server; see docs/territory-advisor.md,
 * "Privacy and security rules"). ZIP boundaries themselves are public
 * Census data.
 */
const querySchema = z.object({
  zips: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(z.string().regex(/^\d{5}$/)).min(1).max(80)),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  if (!rateLimit(`territory-geometry:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ zips: url.searchParams.get("zips") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid zips" }, { status: 400 });
  }

  try {
    const geographies = await getStore().listZipGeographies(parsed.data.zips);
    return NextResponse.json({
      success: true,
      type: "FeatureCollection",
      features: geographies.map((g) => ({
        type: "Feature",
        properties: { zip: g.zip_code },
        geometry: g.geojson,
      })),
    });
  } catch (error) {
    // Geometry is progressive enhancement — never break the advisor flow.
    console.error("[territory-geometry] failed:", error);
    return NextResponse.json({ success: true, type: "FeatureCollection", features: [] });
  }
}
