import Link from "next/link";
import { CalendarCheck2, Clock, Download, FileText, PlayCircle, Search, SlidersHorizontal, Users } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import {
  filterInvestorRows,
  isInvestorSortKey,
  loadInvestorRows,
  sortInvestorRows,
  type InvestorFilters,
  type InvestorSortKey,
} from "@/lib/advisor/investors";
import { getStore } from "@/lib/store";
import { InvestorTable } from "@/components/advisor/InvestorTable";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { INVESTOR_STAGES, STAGE_LABELS } from "@/types/advisor";

const PAGE_SIZE = 25;

export type InvestorsSearchParams = Record<string, string | string[] | undefined>;

function param(params: InvestorsSearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

const selectClass =
  "block w-full rounded-control border-2 border-border-strong bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

function SummaryCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: number;
  sublabel: string;
}) {
  return (
    <Card className="border-border-soft shadow-card">
      <CardContent className="flex items-center gap-3 p-3.5">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-[26px] font-semibold leading-tight text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The filterable client/investor directory, shared by the advisor app
 * (/advisor/investors, "Clients") and the admin dashboard
 * (/advisor/platform/investors, "Investors"). basePath keeps the Clear
 * link, pagination, and sort links on whichever route is hosting it.
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

  const filters: InvestorFilters = {
    search: param(params, "q"),
    stage: param(params, "stage"),
    advisorId: param(params, "advisor"),
    state: param(params, "state"),
    consultation: param(params, "consultation") as InvestorFilters["consultation"],
    fdd: param(params, "fdd") as InvestorFilters["fdd"],
    questionnaire: param(params, "questionnaire") as InvestorFilters["questionnaire"],
    activeWithinHours: param(params, "active") ? Number(param(params, "active")) : undefined,
    followUpOnly: param(params, "followUp") === "1",
  };
  const page = Math.max(1, Number(param(params, "page") ?? "1") || 1);
  const sortParam = param(params, "sort");
  const sortKey: InvestorSortKey | null = sortParam && isInvestorSortKey(sortParam) ? sortParam : null;
  const sortDir: "asc" | "desc" = param(params, "dir") === "desc" ? "desc" : "asc";

  const allRows = await loadInvestorRows(user);
  let filtered = filterInvestorRows(allRows, filters);
  if (sortKey) filtered = sortInvestorRows(filtered, sortKey, sortDir);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const staff = await getStore().listStaffUsers();
  const advisors = staff.filter((s) => s.active);
  const states = [...new Set(allRows.map((r) => r.lead.state).filter((s): s is string => Boolean(s)))].sort();

  const activeQuery = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v !== "" ? [[k, v]] : [])),
  );

  const total = allRows.length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const needsFollowUp = allRows.filter((r) => r.followUp.needed).length;
  const consultationBooked = allRows.filter(
    (r) => Boolean(r.activeAppointment) || r.appointments.some((a) => a.status === "COMPLETED") || Boolean(r.lead.booked_at),
  ).length;
  const fddRequested = allRows.filter((r) => r.fddStatus !== "not_requested").length;
  const videoCompleted = allRows.filter((r) => r.video?.completed).length;

  function hrefFor(key: InvestorSortKey): string {
    const query = new URLSearchParams(activeQuery);
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    query.set("sort", key);
    query.set("dir", nextDir);
    query.delete("page");
    return `${basePath}?${query.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {allRows.length} client{allRows.length === 1 ? "" : "s"}
          </p>
        </div>
        {isAdmin(user) && (
          <a
            href="/api/advisor/export"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border bg-card px-3.5 py-2 text-sm font-medium text-secondary-foreground shadow-card hover:bg-surface"
          >
            <Download className="size-3.5" />
            Export CSV
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard
          icon={Users}
          iconClassName="bg-primary-soft text-primary"
          label="Total Clients"
          value={total}
          sublabel="All time"
        />
        <SummaryCard
          icon={Clock}
          iconClassName="bg-[#fef3c7] text-[#92400e]"
          label="Needs Follow-up"
          value={needsFollowUp}
          sublabel={`${pct(needsFollowUp)}% of clients`}
        />
        <SummaryCard
          icon={CalendarCheck2}
          iconClassName="bg-success-soft text-success"
          label="Consultation Booked"
          value={consultationBooked}
          sublabel={`${pct(consultationBooked)}% of clients`}
        />
        <SummaryCard
          icon={FileText}
          iconClassName="bg-[#ede9fe] text-[#5b21b6]"
          label="FDD Requested"
          value={fddRequested}
          sublabel={`${pct(fddRequested)}% of clients`}
        />
        <SummaryCard
          icon={PlayCircle}
          iconClassName="bg-primary-soft text-primary"
          label="Video Completed"
          value={videoCompleted}
          sublabel={`${pct(videoCompleted)}% of clients`}
        />
      </div>

      <Card className="border-border-soft shadow-card">
        <CardContent className="p-3.5">
          <form method="get" className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <div className="xl:col-span-1">
                <label htmlFor="q" className={labelClass}>
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="q"
                    name="q"
                    type="search"
                    defaultValue={filters.search ?? ""}
                    placeholder="Name, email, or phone"
                    className="block w-full rounded-control border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="stage" className={labelClass}>
                  Stage
                </label>
                <select id="stage" name="stage" defaultValue={filters.stage ?? ""} className={selectClass}>
                  <option value="">All stages</option>
                  {INVESTOR_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="advisor" className={labelClass}>
                  Advisor
                </label>
                <select id="advisor" name="advisor" defaultValue={filters.advisorId ?? ""} className={selectClass}>
                  <option value="">All advisors</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="state" className={labelClass}>
                  State
                </label>
                <select id="state" name="state" defaultValue={filters.state ?? ""} className={selectClass}>
                  <option value="">All states</option>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="consultation" className={labelClass}>
                  Consultation
                </label>
                <select
                  id="consultation"
                  name="consultation"
                  defaultValue={filters.consultation ?? ""}
                  className={selectClass}
                >
                  <option value="">Any</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label htmlFor="fdd" className={labelClass}>
                  FDD
                </label>
                <select id="fdd" name="fdd" defaultValue={filters.fdd ?? ""} className={selectClass}>
                  <option value="">Any</option>
                  <option value="requested">Requested</option>
                  <option value="sent">Sent</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="none">Not requested</option>
                </select>
              </div>
              <div>
                <label htmlFor="questionnaire" className={labelClass}>
                  Questionnaire
                </label>
                <select
                  id="questionnaire"
                  name="questionnaire"
                  defaultValue={filters.questionnaire ?? ""}
                  className={selectClass}
                >
                  <option value="">Any</option>
                  <option value="completed">Completed</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-border-soft pt-2.5">
              <div className="w-44">
                <label htmlFor="active" className={labelClass}>
                  Activity
                </label>
                <select id="active" name="active" defaultValue={String(filters.activeWithinHours ?? "")} className={selectClass}>
                  <option value="">Any time</option>
                  <option value="24">Last 24 hours</option>
                  <option value="72">Last 3 days</option>
                  <option value="168">Last 7 days</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-secondary-foreground">
                <input type="checkbox" name="followUp" value="1" defaultChecked={filters.followUpOnly} />
                Needs follow-up
              </label>
              {sortKey && <input type="hidden" name="sort" value={sortKey} />}
              {sortKey && <input type="hidden" name="dir" value={sortDir} />}
              <div className="ml-auto flex gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Apply filters
                </button>
                <Link
                  href={basePath}
                  className="inline-flex items-center rounded-control border border-border px-4 py-2 text-sm text-secondary-foreground hover:bg-surface"
                >
                  Clear
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border-soft shadow-card">
        <CardContent className="p-0">
          <InvestorTable
            rows={pageRows}
            showNextAction
            showRowActions
            emptyMessage="No clients match these filters."
            sort={{ activeKey: sortKey, activeDir: sortDir, hrefFor }}
          />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const query = new URLSearchParams(activeQuery);
            query.set("page", String(p));
            return (
              <Link
                key={p}
                href={`${basePath}?${query.toString()}`}
                aria-current={p === page ? "page" : undefined}
                className={
                  p === page
                    ? "rounded-control bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    : "rounded-control border border-border px-3 py-1.5 text-sm text-secondary-foreground hover:bg-surface"
                }
              >
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
