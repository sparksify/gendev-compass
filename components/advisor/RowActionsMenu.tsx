"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, MoreHorizontal } from "lucide-react";

/** Per-row overflow menu for the client list table — kept to the two
 * actions that are genuinely useful from a list view; anything deeper
 * belongs on the client detail page itself. */
export function RowActionsMenu({ investorId, portalUrl }: { investorId: string; portalUrl: string }) {
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
        aria-label="Row actions"
        aria-expanded={open}
        className="flex size-7 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-control border border-border bg-card py-1 shadow-card">
          <Link
            href={`/advisor/investors/${investorId}`}
            className="block px-3 py-2 text-sm text-foreground hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            View Details
          </Link>
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy Portal Link"}
          </button>
        </div>
      )}
    </div>
  );
}
