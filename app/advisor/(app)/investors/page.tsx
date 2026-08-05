import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { filterInvestorRows, loadInvestorRows, type InvestorFilters } from "@/lib/advisor/investors";
import { getStore } from "@/lib/store";
import { InvestorTable } from "@/components/advisor/InvestorTable";
import { Card, CardContent } from "@/components/ui/card";
import { INVESTOR_STAGES, STAGE_LABELS } from "@/types/advisor";

export const metadata: Metadata = { title: "Investors" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;

function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

const selectClass =
  "rounded-control border border-border bg-card px-2.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

export default async function InvestorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireStaffUser();
  const params = await searchParams;

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

  const allRows = await loadInvestorRows(user);
  const filtered = filterInvestorRows(allRows, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const staff = await getStore().listStaffUsers();
  const advisors = staff.filter((s) => s.active);
  const states = [...new Set(allRows.map((r) => r.lead.state).filter((s): s is string => Boolean(s)))].sort();

  const activeQuery = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v !== "" ? [[k, v]] : [])),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Investors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {allRows.length} investor{allRows.length === 1 ? "" : "s"}
          </p>
        </div>
        {isAdmin(user) && (
          <a
            href="/api/advisor/export"
            className="rounded-control border border-border bg-card px-3 py-2 text-sm text-secondary-foreground hover:bg-surface"
          >
            Export CSV
          </a>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.search ?? ""}
                placeholder="Name, email, or phone"
                className="block w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="stage" className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label htmlFor="advisor" className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label htmlFor="state" className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label
                htmlFor="consultation"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
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
              <label htmlFor="fdd" className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label
                htmlFor="questionnaire"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
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
            <div>
              <label htmlFor="active" className="mb-1 block text-xs font-medium text-muted-foreground">
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
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Apply
              </button>
              <Link
                href="/advisor/investors"
                className="rounded-control border border-border px-4 py-2 text-sm text-secondary-foreground hover:bg-surface"
              >
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <InvestorTable
            rows={pageRows}
            showNextAction
            emptyMessage="No investors match these filters."
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
                href={`/advisor/investors?${query.toString()}`}
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
