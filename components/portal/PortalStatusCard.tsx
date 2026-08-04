import { brand } from "@/lib/config/brand";

interface PortalStatusCardProps {
  statusLabel: string;
  estimatedMinutesRemaining: number | null;
}

export function PortalStatusCard({ statusLabel, estimatedMinutesRemaining }: PortalStatusCardProps) {
  return (
    <dl className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-3">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Current Status</dt>
        <dd className="mt-1 text-sm font-semibold text-ink">{statusLabel}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Assigned Advisor</dt>
        <dd className="mt-1 text-sm font-semibold text-ink">{brand.advisorName}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Estimated Time Remaining
        </dt>
        <dd className="mt-1 text-sm font-semibold text-ink">
          {estimatedMinutesRemaining === null ? "—" : `${estimatedMinutesRemaining} Minutes`}
        </dd>
      </div>
    </dl>
  );
}
