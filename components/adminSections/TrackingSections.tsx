"use client";

import { useCallback, useState } from "react";
import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { PlatformTabs } from "@/components/admin/PlatformTabs";
import { INK_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
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
    <>
      <PageHeader
        title="Tracking & Pixels"
        subtitle="GTM · Meta Pixel · Conversions API · consent — zero deploys"
        tabs={<PlatformTabs />}
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
              className={INK_BUTTON}
            >
              Save changes
            </button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-10 xl:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
          <TrackingAdminSections authHeaders={authHeaders} onReady={onReady} />
          <TrackingDiagnostics authHeaders={authHeaders} />
        </div>
      </PageBody>
    </>
  );
}
