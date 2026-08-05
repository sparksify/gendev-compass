"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect, FieldError } from "@/components/ui/form-fields";
import { INVESTOR_STAGES, STAGE_LABELS } from "@/types/advisor";

export function StageSelect({ investorId, currentStage }: { investorId: string; currentStage: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const stage = event.target.value;
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "Stage update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <NativeSelect
        defaultValue={currentStage}
        onChange={onChange}
        disabled={saving}
        aria-label="Investor stage"
      >
        {INVESTOR_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </option>
        ))}
      </NativeSelect>
      <FieldError message={error ?? undefined} />
    </div>
  );
}
