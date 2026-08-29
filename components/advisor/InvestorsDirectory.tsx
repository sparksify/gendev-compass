import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Kanban, List as ListIcon, Search } from "lucide-react";
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
import { leadSourceLabel } from "@/lib/config/leadSources";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import {
  GridHead,
  NameCell,
  Panel,
  PageTitle,
  StackCell,
  StagePill,
  V3Page,
} from "@/components/advisor/v3";
import { ACCENT_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
import { VideoWatchedRing } from "@/components/advisor/VideoWatchedBar";
import {
  BulkSelectBar,
  BulkSelectCheckbox,
  BulkSelectProvider,
} from "@/components/advisor/BulkSelect";
import { actionBubble } from "@/components/advisor/clients/shared";
import { ClientsBoardView } from "@/components/advisor/clients/ClientsBoardView";

export type InvestorsSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 15;

/** Table columns, per the handoff's grid ratios. */
const COLS = "1.6fr .8fr .8fr .8fr .9fr 1.25fr";

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

  const view = param(params, "view") === "board" ? "board" : "list";
  const q = param(params, "q");
  const searched = q ? filterInvestorRows(allRows, { search: q }) : allRows;

  // `stage` is the discovery stage (1–5); `chip` carries the non-stage
  // filters. Both land on the same chip row.
  const chipKey = param(params, "stage") ?? param(params, "chip") ?? "all";
  const activeChip = CHIPS.find((chip) => chip.key === chipKey) ?? CHIPS[0];

  // Lead-source facet (?source=): which ad account / channel produced the
  // lead. Composes with the stage chips; counts for each row are faceted
  // against the other row's filter.
  const activeSource = param(params, "source");
  const sourceFiltered = activeSource
    ? searched.filter((row) => (row.lead.source ?? "unknown") === activeSource)
    : searched;
  const filtered = sourceFiltered.filter(activeChip.matches);

  const sourceCounts = new Map<string, number>();
  for (const row of searched.filter(activeChip.matches)) {
    const key = row.lead.source ?? "unknown";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sourceChips = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);

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
    nextView: "list" | "board" = view,
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
    if (nextView === "board") query.set("view", "board");
    if (activeSource) query.set("source", activeSource);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Toggle a source chip on/off, resetting pagination but keeping the rest.
  const sourceHref = (sourceKey: string | null) => {
    const base = hrefFor(activeChip.key, 1);
    const [path, qs] = base.split("?");
    const query = new URLSearchParams(qs ?? "");
    query.delete("source");
    if (sourceKey) query.set("source", sourceKey);
    const next = query.toString();
    return next ? `${path}?${next}` : path;
  };

  // First click sorts highest-first; a second click flips to lowest-first.
  const sortHref = (key: SortKey) =>
    hrefFor(activeChip.key, 1, {
      key,
      dir: sortKey === key && sortDir === "desc" ? "asc" : "desc",
    });

  const viewHref = (nextView: "list" | "board") =>
    hrefFor(activeChip.key, 1, sortKey ? { key: sortKey, dir: sortDir } : null, nextView);

  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = (currentPage - 1) * PAGE_SIZE + rows.length;

  return (
    <V3Page>
      <PageTitle
        title={title}
        meta={
          <>
            {allRows.length} active
            {q && <> · matching &ldquo;{q}&rdquo;</>}
          </>
        }
        actions={
          <>
            <form action={basePath} method="get" className="hidden sm:block">
              <label className="flex w-[230px] items-center gap-2 rounded-control border border-border bg-card px-[13px] py-2 text-[13px]">
                <Search className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={2} />
                <input
                  type="search"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Search clients…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-foreground placeholder:text-[#8b968f] focus:outline-none"
                />
              </label>
            </form>
            {admin && (
              <a href="/api/advisor/export" className={SECONDARY_BUTTON} download>
                Export
              </a>
            )}
            <Link href="/create-lead" className={ACCENT_BUTTON}>
              ＋ New Client
            </Link>
          </>
        }
      />

      <BulkSelectProvider
        endpoint="/api/advisor/investors/bulk-delete"
        noun="client"
        allIds={admin ? sorted.map((row) => row.lead.id) : []}
      >
        {/* Filter chips, with the admin's bulk-select controls at the right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CHIPS.map((chip) => {
              const active = chip.key === activeChip.key;
              const count = sourceFiltered.filter(chip.matches).length;
              return (
                <Link
                  key={chip.key}
                  href={hrefFor(chip.key)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-[7px] rounded-pill px-[13px] py-1.5 text-[12.5px] transition-colors",
                    active
                      ? "bg-primary font-bold text-white"
                      : "border border-border bg-card font-semibold text-secondary-foreground hover:bg-surface-raised",
                  )}
                >
                  {!active && chip.color && (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: chip.color }}
                    />
                  )}
                  {chip.label} · {count}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5">
            <div
              role="tablist"
              aria-label="Clients view"
              className="inline-flex items-center gap-0.5 rounded-control border border-border-strong bg-card p-0.5"
            >
              <ViewToggleLink href={viewHref("list")} active={view === "list"} icon={ListIcon}>
                List
              </ViewToggleLink>
              <ViewToggleLink href={viewHref("board")} active={view === "board"} icon={Kanban}>
                Board
              </ViewToggleLink>
            </div>
            {admin && <BulkSelectBar />}
          </div>
        </div>

        {/* Source facet: one chip per distinct lead source present */}
        {sourceChips.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-faint-foreground">
              Source
            </span>
            <Link
              href={sourceHref(null)}
              aria-current={!activeSource ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-[7px] rounded-pill px-[13px] py-1.5 text-[12.5px] transition-colors",
                !activeSource
                  ? "bg-primary font-bold text-white"
                  : "border border-border bg-card font-semibold text-secondary-foreground hover:bg-surface-raised",
              )}
            >
              All · {searched.filter(activeChip.matches).length}
            </Link>
            {sourceChips.map(([sourceKey, count]) => {
              const active = activeSource === sourceKey;
              return (
                <Link
                  key={sourceKey}
                  href={sourceHref(active ? null : sourceKey)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-[7px] rounded-pill px-[13px] py-1.5 text-[12.5px] transition-colors",
                    active
                      ? "bg-primary font-bold text-white"
                      : "border border-border bg-card font-semibold text-secondary-foreground hover:bg-surface-raised",
                  )}
                >
                  {sourceKey === "unknown" ? "No source" : leadSourceLabel(sourceKey)} · {count}
                </Link>
              );
            })}
          </div>
        )}

        {view === "board" && <ClientsBoardView rows={sorted} />}

        {/* Table */}
        {view === "list" && (
          <>
            <Panel padded={false} className="overflow-x-auto px-[18px] pb-2.5 pt-1.5">
              <div className="min-w-[900px]">
                <GridHead columns={COLS}>
                  <span>Client</span>
                  <span>Stage</span>
                  <SortHeader
                    label="Liquid Capital"
                    href={sortHref("capital")}
                    active={sortKey === "capital"}
                    dir={sortDir}
                  />
                  <SortHeader
                    label="Video Watched"
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
                  <span>Next Action</span>
                </GridHead>

                {rows.length === 0 && (
                  <p className="py-10 text-center text-[13.5px] text-muted-foreground">
                    No clients match this filter.
                  </p>
                )}

                {rows.map((row, index) => {
                  const chip = stageChipFor(row.stage);
                  const capital = compactMoney(
                    labelForValue(
                      row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital,
                    ),
                  );
                  const bubble = actionBubble(row);
                  return (
                    <div
                      key={row.lead.id}
                      className={cn(
                        "grid items-center gap-x-3.5 py-[11px] transition-colors hover:bg-surface-raised",
                        index < rows.length - 1 && "border-b border-border-soft",
                      )}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <span className="flex min-w-0 items-center gap-[7px]">
                        <BulkSelectCheckbox id={row.lead.id} />
                        <NameCell
                          href={`/advisor/investors/${row.lead.id}`}
                          name={`${row.lead.first_name} ${row.lead.last_name}`}
                          sub={row.lead.email}
                        />
                        {row.followUp.needed && (
                          <span
                            aria-label="Follow-up due"
                            title={row.followUp.reasons[0]}
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: SIGNAL.alert }}
                          />
                        )}
                      </span>

                      <span>
                        <StagePill color={chip.color} tint={chip.tint} label={chip.label} />
                      </span>

                      <span className="tabular truncate text-[13px] font-bold text-foreground">
                        {capital}
                      </span>

                      <VideoWatchedRing
                        percent={row.video?.highest_percent_watched ?? null}
                        completed={row.video?.completed ?? false}
                      />

                      <StackCell
                        value={formatRelative(row.lastActivityAt)}
                        sub={`joined ${formatDate(row.lead.created_at)}`}
                      />

                      {row.nextAction === "—" ? (
                        <span className="text-[12.5px] text-ghost-foreground">—</span>
                      ) : (
                        <span className="min-w-0">
                          <span
                            className="inline-flex max-w-full items-center rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold"
                            style={{ color: bubble.color, backgroundColor: bubble.tint }}
                          >
                            <span className="truncate">{row.nextAction}</span>
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="flex items-center justify-between gap-4 text-[12.5px] font-semibold text-muted-foreground">
              <span>
                Showing {firstShown}–{lastShown} of {filtered.length} clients
              </span>
              {pageCount > 1 && (
                <span className="flex items-center gap-1.5">
                  <PageLink
                    href={hrefFor(activeChip.key, currentPage - 1)}
                    disabled={currentPage === 1}
                    label="Previous"
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
                    label="Next"
                  />
                </span>
              )}
            </div>
          </>
        )}
      </BulkSelectProvider>
    </V3Page>
  );
}

/** The List/Board toggle — a plain link pair, consistent with every other
 * piece of state on this page living in the URL rather than client state. */
function ViewToggleLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: typeof ArrowUpDown;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-[7px] text-[12.5px] font-bold transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-surface hover:text-secondary-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
      {children}
    </Link>
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
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className="size-[11px] shrink-0" strokeWidth={2.2} />
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
    "rounded-control px-2.5 py-[5px]",
    current
      ? "bg-primary font-bold text-white"
      : "border border-border bg-card text-muted-foreground",
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
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(className, !current && "hover:bg-surface-raised")}
    >
      {label}
    </Link>
  );
}
