import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { filterInvestorRows, loadInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { compactMoney } from "@/lib/advisor/money";
import {
  DISCOVERY_STAGES,
  discoveryStageIdFor,
  SIGNAL,
  stageChipFor,
} from "@/lib/advisor/discoveryStages";
import { cn } from "@/lib/utils";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { INK_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
import { VideoWatchedRing } from "@/components/advisor/VideoWatchedBar";
import {
  BulkSelectBar,
  BulkSelectCheckbox,
  BulkSelectProvider,
} from "@/components/advisor/BulkSelect";

export type InvestorsSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 15;

/** Table columns, per the handoff's grid ratios. */
const GRID = "grid-cols-[2.1fr_1.7fr_1.1fr_1.3fr_1fr_1.6fr]";

function param(params: InvestorsSearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

interface Chip {
  key: string;
  label: string;
  color: string | null;
  matches: (row: InvestorRow) => boolean;
}

const CHIPS: Chip[] = [
  { key: "all", label: "All", color: null, matches: () => true },
  {
    key: "followup",
    label: "Follow-up",
    color: SIGNAL.alert,
    matches: (row) => row.followUp.needed,
  },
  ...DISCOVERY_STAGES.map((stage) => ({
    key: String(stage.id),
    label: stage.short,
    color: stage.color,
    matches: (row: InvestorRow) => discoveryStageIdFor(row.stage) === stage.id,
  })),
];

/** Ordered capital values — the array index is the sort rank. */
const CAPITAL_ORDER: readonly string[] = LIQUID_CAPITAL_RANGES.map((range) => range.value);

type SortKey = "capital" | "video" | "activity";

/** Unknowns rank below every real value so they sink on "highest first". */
const SORT_RANK: Record<SortKey, (row: InvestorRow) => number> = {
  capital: (row) =>
    CAPITAL_ORDER.indexOf(
      (row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital ?? "") as string,
    ),
  video: (row) => (row.video ? row.video.highest_percent_watched : -1),
  activity: (row) => {
    const at = new Date(row.lastActivityAt).getTime();
    return Number.isFinite(at) ? at : -1;
  },
};

/**
 * Every next action wears its own color, so the table reads at a glance:
 * the hot reds/ambers are outreach owed, the cool hues are process moving
 * along. Unknown strings fall back to the neutral chip; "—" stays plain.
 */
const ACTION_BUBBLES: Record<string, { color: string; tint: string }> = {
  "Schedule follow-up": { color: "#b42318", tint: "#fef3f2" },
  "Rebook cancelled consultation": { color: "#be123c", tint: "#fff1f2" },
  "Resolve FDD delivery error": { color: "#c2410c", tint: "#fff7ed" },
  "Encourage questionnaire completion": { color: "#b45309", tint: "#fffaeb" },
  "Follow up on FDD": { color: "#6d28d9", tint: "#f5f3ff" },
  "Prepare for consultation": { color: "#2463eb", tint: "#eff4ff" },
  "Review outcome and update stage": { color: "#4f46e5", tint: "#eef2ff" },
  "Begin due diligence discussion": { color: "#0e7490", tint: "#f0fafb" },
  "Discuss the franchise agreement": { color: "#047857", tint: "#ecfdf5" },
  "Await portal activity": { color: "#0369a1", tint: "#f0f9ff" },
  "Monitor engagement": { color: "#4d7c0f", tint: "#f7fee7" },
};

function actionBubble(row: InvestorRow): { color: string; tint: string } {
  return (
    ACTION_BUBBLES[row.nextAction] ?? { color: SIGNAL.neutral, tint: SIGNAL.neutralTint }
  );
}

/**
 * The clients list (handoff mock 6b): stage filter chips over a flat grid
 * table — client, discovery stage, liquid capital, video watched, last
 * activity, next action. Every row links to the client detail page; search
 * comes from the header field (?q=).
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
  const admin = isAdmin(user);
  const allRows = await loadInvestorRows(user);

  const q = param(params, "q");
  const searched = q ? filterInvestorRows(allRows, { search: q }) : allRows;

  // `stage` is the discovery stage (1–5); `chip` carries the non-stage
  // filters. Both land on the same chip row.
  const chipKey = param(params, "stage") ?? param(params, "chip") ?? "all";
  const activeChip = CHIPS.find((chip) => chip.key === chipKey) ?? CHIPS[0];
  const filtered = searched.filter(activeChip.matches);

  // Column sorting: clicking Liquid capital or Video watched orders by that
  // column, highest first; clicking again flips it. Default is store order.
  const sortParam = param(params, "sort");
  const sortKey: SortKey | null =
    sortParam === "capital" || sortParam === "video" || sortParam === "activity"
      ? sortParam
      : null;
  const sortDir = param(params, "dir") === "asc" ? "asc" : "desc";
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const rank = SORT_RANK[sortKey];
        return sortDir === "asc" ? rank(a) - rank(b) : rank(b) - rank(a);
      })
    : filtered;

  const page = Math.max(1, Number.parseInt(param(params, "page") ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hrefFor = (
    chipKey: string,
    pageNumber = 1,
    sort: { key: SortKey; dir: "asc" | "desc" } | null = sortKey
      ? { key: sortKey, dir: sortDir }
      : null,
  ) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (chipKey !== "all") {
      const isStage = DISCOVERY_STAGES.some((stage) => String(stage.id) === chipKey);
      query.set(isStage ? "stage" : "chip", chipKey);
    }
    if (sort) {
      query.set("sort", sort.key);
      if (sort.dir === "asc") query.set("dir", "asc");
    }
    if (pageNumber > 1) query.set("page", String(pageNumber));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // First click sorts highest-first; a second click flips to lowest-first.
  const sortHref = (key: SortKey) =>
    hrefFor(activeChip.key, 1, {
      key,
      dir: sortKey === key && sortDir === "desc" ? "asc" : "desc",
    });

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          <>
            {allRows.length} active
            {q && <> · matching &ldquo;{q}&rdquo;</>}
          </>
        }
        actions={
          <>
            <form action={basePath} method="get" className="hidden sm:block">
              <label className="flex w-[270px] items-center gap-2 rounded-control border border-border px-[11px] py-[7px] text-[14px]">
                <Search className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={2} />
                <input
                  type="search"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Search clients…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-foreground placeholder:text-faint-foreground focus:outline-none"
                />
              </label>
            </form>
            {admin && (
              <a href="/api/advisor/export" className={SECONDARY_BUTTON} download>
                Export
              </a>
            )}
            <Link href="/create-lead" className={INK_BUTTON}>
              New client
            </Link>
          </>
        }
      />

      <PageBody className="flex flex-col gap-[18px]">
        <BulkSelectProvider
          endpoint="/api/advisor/investors/bulk-delete"
          noun="client"
          allIds={admin ? sorted.map((row) => row.lead.id) : []}
        >
        {/* Filter chips, with the admin's bulk-select controls at the right */}
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => {
            const active = chip.key === activeChip.key;
            const count = searched.filter(chip.matches).length;
            return (
              <Link
                key={chip.key}
                href={hrefFor(chip.key)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-[13px] py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-foreground font-bold text-white"
                    : "border border-border font-semibold hover:bg-surface-raised",
                )}
                style={active ? undefined : { color: chip.color ?? "#667085" }}
              >
                {!active && chip.color && (
                  <span
                    aria-hidden
                    className="size-[5px] rounded-full"
                    style={{ backgroundColor: chip.color }}
                  />
                )}
                {chip.label} · {count}
              </Link>
            );
          })}
          {admin && (
            <span className="ml-auto">
              <BulkSelectBar />
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div
              className={cn(
                "grid gap-x-4 border-b border-border py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground",
                GRID,
              )}
            >
              <span>Client</span>
              <span>Stage</span>
              <SortHeader
                label="Liquid capital"
                href={sortHref("capital")}
                active={sortKey === "capital"}
                dir={sortDir}
              />
              <SortHeader
                label="Video watched"
                href={sortHref("video")}
                active={sortKey === "video"}
                dir={sortDir}
              />
              <SortHeader
                label="Activity"
                href={sortHref("activity")}
                active={sortKey === "activity"}
                dir={sortDir}
              />
              <span>Next action</span>
            </div>

            {rows.length === 0 && (
              <p className="py-10 text-center text-[14.5px] text-muted-foreground">
                No clients match this filter.
              </p>
            )}

            {rows.map((row) => {
              const chip = stageChipFor(row.stage);
              const capital = compactMoney(
                labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital),
              );
              return (
                <Link
                  key={row.lead.id}
                  href={`/advisor/investors/${row.lead.id}`}
                  className={cn(
                    "grid items-center gap-x-4 border-b border-border-soft py-[13px] text-[14.5px] transition-colors hover:bg-surface-raised",
                    GRID,
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-[7px] font-bold text-foreground">
                      <BulkSelectCheckbox id={row.lead.id} />
                      <span className="truncate">
                        {row.lead.first_name} {row.lead.last_name}
                      </span>
                      {row.followUp.needed && (
                        <span
                          aria-label="Follow-up due"
                          title={row.followUp.reasons[0]}
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: SIGNAL.alert }}
                        />
                      )}
                    </span>
                    <span className="block truncate text-[12.5px] text-faint-foreground">
                      {row.lead.email}
                    </span>
                  </span>
                  <span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[12.5px] font-bold"
                      style={{ color: chip.color, backgroundColor: chip.tint }}
                    >
                      <span
                        aria-hidden
                        className="size-[5px] rounded-full"
                        style={{ backgroundColor: chip.color }}
                      />
                      {chip.label}
                    </span>
                  </span>
                  <span className="tabular truncate text-secondary-foreground">{capital}</span>
                  <VideoWatchedRing
                    percent={row.video?.highest_percent_watched ?? null}
                    completed={row.video?.completed ?? false}
                  />
                  <span className="min-w-0">
                    <span className="tabular block truncate text-[13.5px] leading-[1.45] text-secondary-foreground">
                      {formatRelative(row.lastActivityAt)}
                    </span>
                    <span className="tabular block truncate text-[12px] text-ghost-foreground">
                      joined {formatDate(row.lead.created_at)}
                    </span>
                  </span>
                  {row.nextAction === "—" ? (
                    <span className="text-[13.5px] text-ghost-foreground">—</span>
                  ) : (
                    (() => {
                      const bubble = actionBubble(row);
                      return (
                        <span className="min-w-0">
                          <span
                            className="inline-flex max-w-full items-center rounded-full px-[11px] py-1 text-[12.5px] font-bold"
                            style={{ color: bubble.color, backgroundColor: bubble.tint }}
                          >
                            <span className="truncate">{row.nextAction}</span>
                          </span>
                        </span>
                      );
                    })()
                  )}
                </Link>
              );
            })}

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 pt-3.5 text-[13px] text-faint-foreground">
              <span>
                Showing {rows.length} of {filtered.length}
              </span>
              {pageCount > 1 && (
                <span className="flex gap-1.5">
                  <PageLink
                    href={hrefFor(activeChip.key, currentPage - 1)}
                    disabled={currentPage === 1}
                    label="←"
                  />
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                    <PageLink
                      key={number}
                      href={hrefFor(activeChip.key, number)}
                      label={String(number)}
                      current={number === currentPage}
                    />
                  ))}
                  <PageLink
                    href={hrefFor(activeChip.key, currentPage + 1)}
                    disabled={currentPage === pageCount}
                    label="→"
                  />
                </span>
              )}
            </div>
          </div>
        </div>
        </BulkSelectProvider>
      </PageBody>
    </>
  );
}

/** A sortable column header: click to order by it, click again to flip. */
function SortHeader({
  label,
  href,
  active,
  dir,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
}) {
  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <Link
      href={href}
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}
      className={cn(
        "inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className="size-3 shrink-0" strokeWidth={2.2} />
    </Link>
  );
}

function PageLink({
  href,
  label,
  current,
  disabled,
}: {
  href: string;
  label: string;
  current?: boolean;
  disabled?: boolean;
}) {
  const className = cn(
    "rounded-md border border-border px-2.5 py-1",
    current && "font-bold text-foreground",
    disabled && "text-ghost-foreground",
  );
  if (disabled) {
    return (
      <span aria-disabled className={className}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={cn(className, "hover:bg-surface-raised")}>
      {label}
    </Link>
  );
}
