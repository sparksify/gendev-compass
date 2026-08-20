import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { filterInvestorRows, loadInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import { ClientsWithPanel, type ClientListRow } from "@/components/advisor/clientsPanel/ClientsWithPanel";

export type InvestorsSearchParams = Record<string, string | string[] | undefined>;

function param(params: InvestorsSearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Filter-chip groups over the pipeline stages. */
const CHIPS: Array<{ key: string; label: string; stages: string[] | null }> = [
  { key: "all", label: "All", stages: null },
  { key: "new", label: "New", stages: ["NEW_LEAD", "PORTAL_ACTIVE"] },
  {
    key: "engaged",
    label: "Engaged",
    stages: [
      "ENGAGED",
      "QUESTIONNAIRE_STARTED",
      "QUESTIONNAIRE_COMPLETED",
      "CONSULTATION_SCHEDULED",
      "CONSULTATION_COMPLETED",
      "FDD_SENT",
      "FDD_ACKNOWLEDGED",
      "DUE_DILIGENCE",
      "QUALIFIED",
    ],
  },
  { key: "signed", label: "Signed", stages: ["CLOSED_INVESTED"] },
];

function toListRow(row: InvestorRow): ClientListRow {
  return {
    id: row.lead.id,
    name: `${row.lead.first_name} ${row.lead.last_name}`,
    email: row.lead.email,
    brandName: row.brand?.name ?? null,
    stage: row.lead.current_stage,
    source: row.lead.source,
    territories: row.lead.territories_wanted ?? null,
    videoPercent: row.video ? Math.min(100, Math.max(0, row.video.highest_percent_watched)) : null,
    videoCompleted: row.video?.completed ?? false,
    liquidCapital: labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital),
    netWorth: labelForValue(row.questionnaire?.net_worth ?? row.lead.initial_net_worth),
  };
}

/**
 * The clients list per the client-panel handoff: header + Add Client,
 * stage filter chips with counts, and the table that opens the slide-in
 * Client Details drawer. Search comes from the shell's top-bar field (?q=).
 */
export async function InvestorsDirectory({
  params,
  basePath,
  title,
}: {
  params: InvestorsSearchParams;
  basePath: string;
  title: string;
}) {
  const user = await requireStaffUser();
  const allRows = await loadInvestorRows(user);

  const q = param(params, "q");
  const searched = q ? filterInvestorRows(allRows, { search: q }) : allRows;

  const chipKey = param(params, "chip") ?? "all";
  const activeChip = CHIPS.find((c) => c.key === chipKey) ?? CHIPS[0];
  const rows = activeChip.stages
    ? searched.filter((r) => activeChip.stages!.includes(r.lead.current_stage))
    : searched;

  const countFor = (chip: (typeof CHIPS)[number]) =>
    chip.stages ? searched.filter((r) => chip.stages!.includes(r.lead.current_stage)).length : searched.length;

  const hrefFor = (chip: (typeof CHIPS)[number]) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (chip.key !== "all") query.set("chip", chip.key);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-[-0.01em] text-foreground">{title}</h1>
          <p className="text-[13px] text-muted-foreground">
            {allRows.length} active client{allRows.length === 1 ? "" : "s"}
            {q && ` · matching “${q}”`}
          </p>
        </div>
        <Link
          href="/create-lead"
          className="inline-flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_6px_rgb(36_99_235/0.3)] transition-colors hover:bg-primary-hover"
        >
          <Plus className="size-4" />
          Add Client
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const active = chip.key === activeChip.key;
          const count = countFor(chip);
          return (
            <Link
              key={chip.key}
              href={hrefFor(chip)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                active
                  ? "border-[#b9cffc] bg-primary-soft font-bold text-primary"
                  : "border-border bg-card font-semibold text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
              <span className={cn("text-[11.5px] font-semibold", active ? "text-[#7fa4f5]" : "text-faint-foreground")}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <ClientsWithPanel rows={rows.map(toListRow)} />
    </div>
  );
}
