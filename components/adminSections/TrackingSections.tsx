"use client";

import { useCallback, useState } from "react";
import { PageTitle, V3Page } from "@/components/advisor/v3";
import { PlatformTabs } from "@/components/admin/PlatformTabs";
import { ACCENT_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
import {
  TrackingAdminSections,
  type TrackingSettingsApi,
} from "@/components/adminSections/TrackingAdminSections";
import { TrackingDiagnostics } from "@/components/adminSections/TrackingDiagnostics";

/**
 * Tracking & Pixels (handoff mock 8b): the provider setting cards on the
 * left, delivery diagnostics on the right, and both header actions wired to
 * the settings column.
 */
export function TrackingSections({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [api, setApi] = useState<TrackingSettingsApi | null>(null);
  const onReady = useCallback((next: TrackingSettingsApi) => setApi(next), []);

  return (
    <V3Page>
      <PageTitle
        title="Tracking & Pixels"
        meta="GTM · Meta Pixel · Conversions API · consent — zero deploys"
        actions={
          <>
            <button
              type="button"
              onClick={() => api?.sendTestEvent()}
              disabled={!api}
              className={SECONDARY_BUTTON}
            >
              Send test event
            </button>
            <button
              type="button"
              onClick={() => api?.save()}
              disabled={!api}
              className={ACCENT_BUTTON}
            >
              Save changes
            </button>
          </>
        }
      />
      <PlatformTabs />
      <div className="grid items-start gap-3.5 xl:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <TrackingAdminSections authHeaders={authHeaders} onReady={onReady} />
        <TrackingDiagnostics authHeaders={authHeaders} />
      </div>
    </V3Page>
  );
}
