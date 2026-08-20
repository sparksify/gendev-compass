"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Compact read-only field with a one-click copy button, used for the portal link. */
export function CopyLinkField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy portal link"
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-card hover:text-primary"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
