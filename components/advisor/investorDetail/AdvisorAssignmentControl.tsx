"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "./InitialsAvatar";

interface AdvisorOption {
  id: string;
  name: string;
}

/**
 * Compact assignment control for the header's meta grid — an avatar + first
 * name with a transparent native <select> overlay, so reassigning feels
 * like a quick status change rather than filling out a form field.
 * Admin-only; non-admins see the assigned advisor's name as plain text
 * instead (see the client detail page's Record block).
 */
export function AdvisorAssignmentControl({
  investorId,
  currentAdvisorId,
  advisors,
}: {
  investorId: string;
  currentAdvisorId: string | null;
  advisors: AdvisorOption[];
}) {
  const router = useRouter();
  const [advisorId, setAdvisorId] = useState(currentAdvisorId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = advisors.find((a) => a.id === advisorId) ?? null;

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const previous = advisorId;
    setAdvisorId(next);
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId: next || null }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setAdvisorId(previous);
        setError(data.error ?? "Assignment failed.");
        return;
      }
      router.refresh();
    } catch {
      setAdvisorId(previous);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className={cn("relative inline-flex items-center gap-1.5", saving && "opacity-60")}>
        <select
          value={advisorId}
          onChange={onChange}
          disabled={saving}
          aria-label="Assigned advisor"
          className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
        >
          <option value="">Unassigned</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none flex items-center gap-1.5 text-[15.5px] leading-[1.45] font-medium text-foreground">
          {current && <InitialsAvatar name={current.name} size="sm" />}
          {current ? current.name.split(" ")[0] : "Unassigned"}
          <ChevronDown className="size-3 text-muted-foreground" />
        </span>
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
