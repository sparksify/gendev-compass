"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";

/** "More actions" dropdown for the Next Best Action panel — the two safe
 * secondary actions that always apply: open the client's portal, copy the
 * portal link. */
export function MoreActionsMenu({ portalUrl }: { portalUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-control border border-[#dfe3e8] bg-card px-3.5 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface"
      >
        More actions
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-44 rounded-control border border-border bg-card py-1 shadow-card">
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface"
          >
            <ExternalLink className="size-3.5" />
            Open portal
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy portal link"}
          </button>
        </div>
      )}
    </div>
  );
}
