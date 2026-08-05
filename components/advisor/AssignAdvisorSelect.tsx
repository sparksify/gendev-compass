"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect, FieldError } from "@/components/ui/form-fields";

interface AdvisorOption {
  id: string;
  name: string;
}

export function AssignAdvisorSelect({
  investorId,
  currentAdvisorId,
  advisors,
}: {
  investorId: string;
  currentAdvisorId: string | null;
  advisors: AdvisorOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const advisorId = event.target.value || null;
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "Assignment failed.");
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
        defaultValue={currentAdvisorId ?? ""}
        onChange={onChange}
        disabled={saving}
        aria-label="Assigned advisor"
      >
        <option value="">Unassigned</option>
        {advisors.map((advisor) => (
          <option key={advisor.id} value={advisor.id}>
            {advisor.name}
          </option>
        ))}
      </NativeSelect>
      <FieldError message={error ?? undefined} />
    </div>
  );
}
