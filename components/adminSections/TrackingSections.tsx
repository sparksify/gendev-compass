"use client";

import { useState } from "react";
import { TrackingAdminSections } from "@/components/adminSections/TrackingAdminSections";
import { TrackingDiagnostics } from "@/components/adminSections/TrackingDiagnostics";

const TABS = [
  { key: "settings", label: "Settings" },
  { key: "diagnostics", label: "Diagnostics" },
] as const;

export function TrackingSections({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("settings");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "settings" ? (
        <TrackingAdminSections authHeaders={authHeaders} />
      ) : (
        <TrackingDiagnostics authHeaders={authHeaders} />
      )}
    </div>
  );
}
