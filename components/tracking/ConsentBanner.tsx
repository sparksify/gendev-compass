"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConsentBannerProps {
  /** False when the deployment's tracking settings don't require a consent decision — nothing renders. */
  required: boolean;
  /** True when a consent cookie already exists — nothing renders (re-shown only via a future preferences link). */
  alreadyDecided: boolean;
  portalToken?: string;
}

/**
 * Minimal consent banner (spec §20). Placeholder copy — jurisdiction-
 * specific legal requirements are not invented here; have legal/privacy
 * counsel review before relying on this for compliance. Necessary portal
 * functionality is never gated by this; only marketing tags are.
 */
export function ConsentBanner({ required, alreadyDecided, portalToken }: ConsentBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (!required || alreadyDecided || dismissed) return null;

  async function decide(analytics: boolean, marketing: boolean) {
    setDismissed(true);
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics, marketing, portalToken }),
      });
    } catch {
      // Consent write failures fall back to "not granted" server-side —
      // never block the portal experience over this.
    }
    router.refresh();
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-lg sm:p-5"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          We use cookies for essential portal functionality and, with your consent, to measure
          engagement and personalize marketing. See our Privacy Policy for details.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void decide(false, false)}
            className="rounded-control border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => void decide(true, true)}
            className="rounded-control bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
