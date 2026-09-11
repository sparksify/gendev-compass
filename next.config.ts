import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Static advertorial lander (The Second Act Report) lives in
  // public/second-act.html; serve it at the clean /second-act URL.
  async rewrites() {
    return [{ source: "/second-act", destination: "/second-act.html" }];
  },
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
