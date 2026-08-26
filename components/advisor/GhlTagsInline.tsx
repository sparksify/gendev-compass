"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Live HighLevel tags for this lead, fetched client-side so a HighLevel
 * outage or slow response never holds up the investor page's own render.
 */
export function GhlTagsInline({ investorId }: { investorId: string }) {
  const [tags, setTags] = useState<string[] | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/advisor/investors/${investorId}/ghl-tags`);
        const data = (await response.json()) as { success: boolean; tags?: string[]; configured?: boolean };
        if (cancelled) return;
        if (data.success) {
          setTags(data.tags ?? []);
          setConfigured(data.configured ?? true);
        } else {
          setTags([]);
        }
      } catch {
        if (!cancelled) setTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [investorId]);

  if (tags === null) {
    return <span className="text-xs text-muted-foreground">Loading HighLevel tags…</span>;
  }
  if (!configured) return null; // HighLevel not configured for this deployment — nothing to show.
  if (tags.length === 0) {
    return <span className="text-xs text-muted-foreground">No HighLevel tags</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
