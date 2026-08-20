"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, ClipboardList, FileText, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TONE_PILL, type MilestoneTone } from "@/lib/advisor/milestones";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { FDD_STATUS_LABELS } from "@/lib/fdd/status";
import type { FddStatus } from "@/types/fdd";
import {
  CASH_CONTRIBUTION_RANGES,
  CREDIT_SCORE_RANGES,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  LENDER_STATUS_OPTIONS,
  type QuestionnaireRecord,
} from "@/types/questionnaire";
import { cn } from "@/lib/utils";

function Pill({ tone, children }: { tone: MilestoneTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

const ROW_CLASS =
  "grid grid-cols-[24px_minmax(max-content,1fr)_auto_auto] items-center gap-x-2.5 border-b border-border-soft py-[7px]";
const ACTION_CLASS = "justify-self-end text-[12.5px] font-semibold text-primary hover:underline";

/**
 * One card, four rows: the client's progress through the funnel with an
 * action rail on the right. Replaces the separate Consultations, FDD
 * Status, and (collapsed) Funding Profile cards.
 */
export function ClientProgressCard({
  investorId,
  email,
  portalUrl,
  consultation,
  fddStatus,
  fddInFlight,
  questionnaire,
  questionnaireCompleted,
  questionnaireStarted,
}: {
  investorId: string;
  email: string;
  portalUrl: string;
  consultation: { label: string; tone: MilestoneTone; date: string | null };
  fddStatus: FddStatus;
  fddInFlight: boolean;
  questionnaire: QuestionnaireRecord | null;
  questionnaireCompleted: boolean;
  questionnaireStarted: boolean;
}) {
  const router = useRouter();
  const [fddBusy, setFddBusy] = useState(false);
  const [fddError, setFddError] = useState<string | null>(null);
  const [fundingOpen, setFundingOpen] = useState(false);

  async function sendFdd() {
    setFddBusy(true);
    setFddError(null);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: fddInFlight }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setFddError(data.error ?? "Request failed.");
        return;
      }
      router.refresh();
    } catch {
      setFddError("Could not reach the server.");
    } finally {
      setFddBusy(false);
    }
  }

  const fddTone: MilestoneTone =
    fddStatus === "not_requested" || fddStatus === "error_manual_review"
      ? "neutral"
      : fddStatus === "fdd_received" || fddStatus === "waiting_period_active" || fddStatus === "eligible_for_agreement"
        ? "green"
        : "amber";

  const funding = !questionnaire
    ? { label: "Not started", tone: "neutral" as MilestoneTone }
    : questionnaire.funding_followup_requested
      ? { label: "Assistance requested", tone: "amber" as MilestoneTone }
      : { label: "Provided", tone: "green" as MilestoneTone };

  const cqMailto = `mailto:${email}?subject=${encodeURIComponent("Your client questionnaire")}&body=${encodeURIComponent(
    `Hi,\n\nWhen you have a few minutes, please complete your client questionnaire here:\n${portalUrl}/questionnaire\n\nThank you!`,
  )}`;

  return (
    <Card className="h-full">
      <CardContent className="px-[15px] py-[13px]">
        <p className="text-[15px] font-bold text-foreground">
          Client progress
        </p>

        <div className="mt-1.5">
          {/* Consultation */}
          <div className={ROW_CLASS}>
            <Calendar className="size-[15px] text-primary" strokeWidth={1.9} />
            <span className="whitespace-nowrap text-[13px] font-medium text-foreground">Consultation</span>
            <span className="justify-self-start">
              <Pill tone={consultation.tone}>
                {consultation.label}
                {consultation.date && ` · ${consultation.date}`}
              </Pill>
            </span>
            <a href={`${portalUrl}/schedule`} target="_blank" rel="noreferrer" className={ACTION_CLASS}>
              Schedule
            </a>
          </div>

          {/* FDD */}
          <div className={ROW_CLASS}>
            <FileText className="size-[15px] text-primary" strokeWidth={1.9} />
            <span className="whitespace-nowrap text-[13px] font-medium text-foreground">FDD</span>
            <span className="justify-self-start">
              <Pill tone={fddTone}>{fddStatus === "not_requested" ? "Not requested" : FDD_STATUS_LABELS[fddStatus]}</Pill>
            </span>
            <button type="button" onClick={sendFdd} disabled={fddBusy} className={cn(ACTION_CLASS, "disabled:opacity-50")}>
              {fddBusy ? "Sending…" : fddInFlight ? "Resend FDD" : "Send FDD"}
            </button>
          </div>
          {fddError && <p className="py-1 pl-[34px] text-[11px] text-destructive">{fddError}</p>}

          {/* Funding profile */}
          <div className={ROW_CLASS}>
            <Landmark className="size-[15px] text-primary" strokeWidth={1.9} />
            <span className="whitespace-nowrap text-[13px] font-medium text-foreground">Funding profile</span>
            <span className="justify-self-start">
              <Pill tone={funding.tone}>{funding.label}</Pill>
            </span>
            <button
              type="button"
              onClick={() => setFundingOpen((v) => !v)}
              aria-expanded={fundingOpen}
              aria-label="Toggle funding detail"
              disabled={!questionnaire}
              className="justify-self-end text-faint-foreground disabled:opacity-40"
            >
              <ChevronRight className={cn("size-3.5 transition-transform", fundingOpen && "rotate-90")} />
            </button>
          </div>
          {fundingOpen && questionnaire && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border-soft py-2 pl-[34px]">
              {[
                ["Credit range", labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range)],
                ["Liquid capital", labelForValue(questionnaire.liquid_capital)],
                ["Cash contribution", labelIn(CASH_CONTRIBUTION_RANGES, questionnaire.available_cash_contribution)],
                ["Financing need", labelIn(FINANCING_NEED_OPTIONS, questionnaire.financing_need)],
                [
                  "Financing %",
                  questionnaire.financing_need === "no"
                    ? "N/A"
                    : labelIn(FINANCING_PERCENTAGE_OPTIONS, questionnaire.preferred_financing_percentage),
                ],
                [
                  "Lender status",
                  questionnaire.financing_need === "no"
                    ? "N/A"
                    : labelIn(LENDER_STATUS_OPTIONS, questionnaire.lender_status),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10.5px] text-faint-foreground">{label}</p>
                  <p className="text-xs font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Questionnaire */}
          <div className={cn(ROW_CLASS, "border-b-0 pb-px")}>
            <ClipboardList className="size-[15px] text-primary" strokeWidth={1.9} />
            <span className="whitespace-nowrap text-[13px] font-medium text-foreground">Questionnaire</span>
            <span className="justify-self-start">
              <Pill
                tone={questionnaireCompleted ? "green" : questionnaireStarted ? "amber" : "neutral"}
              >
                {questionnaireCompleted ? "Completed" : questionnaireStarted ? "Pending" : "Not started"}
              </Pill>
            </span>
            {questionnaireCompleted ? (
              <a href="#questionnaire-responses" className={ACTION_CLASS}>
                View
              </a>
            ) : (
              <a href={cqMailto} className={ACTION_CLASS}>
                Send CQ link
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
