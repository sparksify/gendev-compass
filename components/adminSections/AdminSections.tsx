"use client";

import Link from "next/link";
import { AssetsSection } from "./AssetsSection";
import { ResourcesSection } from "./ResourcesSection";
import { FddSection } from "./FddSection";
import { ZipDataSection } from "./ZipDataSection";
import { CensusDataHealthSection } from "./CensusDataHealthSection";

/**
 * The platform-admin toolset (site assets, FDD workflow, territory data,
 * test leads), stacked on one page for the legacy standalone /admin page
 * (pass authHeaders={"x-admin-password": ...}). The unified admin
 * dashboard at /advisor/platform renders these same sections on separate
 * pages instead (app/advisor/(admin)/platform). Every API these sections
 * call accepts both credentials (lib/advisor/adminAccess.ts).
 */
export function AdminSections({ authHeaders }: { authHeaders: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <AssetsSection authHeaders={authHeaders} />
      <ResourcesSection authHeaders={authHeaders} />
      <FddSection authHeaders={authHeaders} />
      <ZipDataSection authHeaders={authHeaders} />
      <CensusDataHealthSection authHeaders={authHeaders} />
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Test Leads</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Generate a personalized portal link for testing or a new prospect.
        </p>
        <Link
          href="/admin/create-lead"
          className="mt-3 inline-block rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Create Test Lead →
        </Link>
      </div>
    </div>
  );
}
