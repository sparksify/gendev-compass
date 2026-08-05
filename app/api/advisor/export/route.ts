import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { STAGE_LABELS } from "@/lib/advisor/stages";
import type { InvestorStage } from "@/types/advisor";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Admin-only CSV export of the investor list. */
export async function GET(): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const rows = await loadInvestorRows(auth.user);
  const header = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "State",
    "Assigned Advisor",
    "Stage",
    "Lead Source",
    "Liquid Capital",
    "Net Worth",
    "Investment Timeline",
    "Video % Watched",
    "Consultation Status",
    "FDD Status",
    "Last Activity",
    "Created",
  ];
  const lines = rows.map((row) =>
    [
      row.lead.first_name,
      row.lead.last_name,
      row.lead.email,
      row.lead.phone ?? "",
      row.lead.state ?? "",
      row.advisor ? `${row.advisor.first_name} ${row.advisor.last_name}` : "",
      STAGE_LABELS[row.lead.current_stage as InvestorStage] ?? row.lead.current_stage,
      row.lead.source ?? "",
      labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital),
      labelForValue(row.questionnaire?.net_worth ?? row.lead.initial_net_worth),
      labelForValue(row.questionnaire?.investment_timeline),
      row.video ? String(Math.round(row.video.highest_percent_watched)) : "",
      row.activeAppointment?.status ?? (row.lead.booked_at ? "SCHEDULED" : ""),
      row.fddStatus,
      row.lastActivityAt,
      row.lead.created_at,
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="investors-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
