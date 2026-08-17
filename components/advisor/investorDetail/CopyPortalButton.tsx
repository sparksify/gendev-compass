"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** 30×30 bordered icon button that copies the portal URL — replaces the
 * old inline read-only URL field in the client header. */
export function CopyPortalButton({ portalUrl }: { portalUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy portal link"}
      title="Copy portal link"
      className="flex size-[30px] shrink-0 items-center justify-center rounded-control border border-border bg-card text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}
