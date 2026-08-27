import { Panel, Pill } from "@/components/advisor/v3";
import type { QualificationFactor, IntentRead, StageAge } from "@/lib/advisor/clientIntelligence";

function Meter({
  label,
  value,
  percent,
  hint,
  title,
}: {
  label: string;
  value: string;
  percent: number;
  hint?: string;
  title?: string;
}) {
  return (
    <div title={title}>
      <div className="flex justify-between text-[12.5px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="tabular font-extrabold text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-[5px] bg-border-soft">
        <span
          className="block h-full rounded-[5px] bg-[#1b7a61]"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {hint && <p className="mt-[5px] text-[11px] font-semibold text-faint-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The read on this client: how strong their intent looks, what the
 * qualification score is actually made of, and whether the stage is aging.
 *
 * It replaced a completion donut, which measured how much of the record was
 * filled in — a fact about our data entry, not about the client.
 */
export function ClientIntelligenceCard({
  intent,
  score,
  factors,
  videoPercent,
  daysInStage,
  age,
}: {
  intent: IntentRead;
  score: number | null;
  factors: QualificationFactor[];
  videoPercent: number | null;
  daysInStage: number | null;
  age: StageAge | null;
}) {
  const factorLine = factors.map((factor) => `${factor.label} ${factor.strength}`).join(" · ");

  return (
    <Panel>
      <p className="text-[15px] font-bold text-foreground">Client Intelligence</p>

      <div className="mt-[11px] flex items-center justify-between gap-3 rounded-[11px] bg-surface-raised px-3.5 py-[11px]">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-pill border border-[#f0e1b4] bg-[#fff6d9] px-[11px] py-[3px] text-[11px] font-extrabold tracking-[0.06em] text-accent-strong">
            {intent.band}
          </span>
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">{intent.trend}</p>
        </div>
        <span className="tabular shrink-0 text-[23px] font-extrabold text-foreground">
          {score === null ? "—" : score}
          {score !== null && (
            <span className="text-[13px] font-bold text-faint-foreground"> / 100</span>
          )}
        </span>
      </div>

      <div className="mt-[13px] flex flex-col gap-[11px]">
        <Meter
          label="Video watched"
          value={videoPercent === null ? "—" : `${videoPercent}%`}
          percent={videoPercent ?? 0}
        />

        {score !== null && (
          <Meter
            label="Qualification score"
            value={`${score}/100`}
            percent={score}
            hint={factorLine}
            title={factors.map((factor) => `${factor.label}: ${factor.strength}`).join(" · ")}
          />
        )}

        {daysInStage !== null && (
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
            <span>Days in stage</span>
            <span className="inline-flex items-center gap-[7px]">
              <span className="tabular font-extrabold text-foreground">
                {daysInStage} day{daysInStage === 1 ? "" : "s"}
              </span>
              {age && (
                <Pill tone={age.tone} className="px-[9px] py-[1.5px] text-[10.5px]">
                  {age.label}
                </Pill>
              )}
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}
