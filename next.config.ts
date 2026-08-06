import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The shipped ZCTA boundary bundle (data/zcta/*.json.gz — all 50 states
  // + DC, pre-simplified; see lib/territory/zctaBundle.ts) must be traced
  // into the serverless bundles of the routes that read it, since it's
  // loaded with fs at runtime rather than imported.
  outputFileTracingIncludes: {
    "/api/admin/import-polygons": ["./data/zcta/**"],
    "/api/cron/backfill-polygons": ["./data/zcta/**"],
  },
};

export default nextConfig;
