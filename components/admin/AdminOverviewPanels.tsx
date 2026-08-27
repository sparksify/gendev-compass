"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccentNote, LeaderRow, Panel, PanelHeader, Pill, TopBarStat } from "@/components/advisor/v3";
import { DISCOVERY_STAGES, SIGNAL } from "@/lib/advisor/discoveryStages";
import type { FddLeadSummary } from "@/components/adminSections/FddSection";
import type { CensusDataHealth } from "@/components/adminSections/CensusDataHealthSection";
import { formatDateTime } from "@/components/adminSections/shared";

interface OverviewStats {
  totalInvestors: number;
  newThisWeek: number;
  activeJourneys: number;
  fddRequested: number;
  fddInFlight: number;
}

interface FddConfig {
  ghlConfigured: boolean;
  webhookSecretConfigured: boolean;
  waitingPeriodDays: number;
}

const QUICK_ACTIONS = [
  { href: "/advisor/platform/resources", label: "Add resource" },
  { href: "/advisor/platform/branding", label: "Upload brand asset" },
  { href: "/advisor/platform/test-leads", label: "Create test lead" },
  { href: "/advisor/platform/fdd", label: "Manage FDD requests" },
  { href: "/advisor/platform/zip-data", label: "Load ZIP data" },
  { href: "/advisor/platform/census-health", label: "Census data health" },
];

/** FDD statuses in the handoff's tones: sent amber, delivered violet,
 * waiting/eligible green, error red, everything else neutral. */
const FDD_TONE: Record<string, { color: string; tint: string }> = {
  request_processing: { color: SIGNAL.warning, tint: SIGNAL.warningTint },
  fdd_sent: { color: SIGNAL.warning, tint: SIGNAL.warningTint },
  fdd_delivered: { color: DISCOVERY_STAGES[2].color, tint: DISCOVERY_STAGES[2].tint },
  fdd_received: { color: DISCOVERY_STAGES[2].color, tint: DISCOVERY_STAGES[2].tint },
  waiting_period_active: { color: SIGNAL.success, tint: SIGNAL.successTint },
  eligible_for_agreement: { color: SIGNAL.success, tint: SIGNAL.successTint },
  error_manual_review: { color: SIGNAL.alert, tint: SIGNAL.alertTint },
};

function StatusPill({ status }: { status: string }) {
  const tone = FDD_TONE[status] ?? { color: SIGNAL.neutral, tint: SIGNAL.neutralTint };
  const label =
    status === "error_manual_review" ? "error · resend" : status.replaceAll("_", " ");
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold capitalize"
      style={{ color: tone.color, backgroundColor: tone.tint }}
    >
      {label}
    </span>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span>
      <span className="block text-[11px] font-semibold text-faint-foreground">{label}</span>
      <strong
        className="tabular mt-0.5 block text-[14px] font-extrabold"
        style={color ? { color } : undefined}
      >
        {value}
      </strong>
    </span>
  );
}

function IntegrationRow({
  ok,
  label,
  value,
  plain,
}: {
  ok: boolean;
  label: string;
  value: string;
  /** A setting rather than a connection — reads as text, not a status pill. */
  plain?: boolean;
}) {
  return (
    <span className="flex items-center justify-between gap-3.5 border-b border-border-soft py-[9px] last:border-b-0">
      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
        <span
          aria-hidden
          className="size-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: ok ? SIGNAL.success : "#c2410c" }}
        />
        {label}
      </span>
      {plain ? (
        <span className="font-bold text-muted-foreground">{value}</span>
      ) : (
        <Pill tone={ok ? "success" : "danger"}>{value}</Pill>
      )}
    </span>
  );
}

/**
 * Portal Admin's overview (handoff mock 8a): four KPI rules, recent FDD
 * requests and census health on the left, quick actions / portal assets /
 * integrations on the right. Investor KPIs are computed server-side; the
 * operational panels fetch from the existing admin APIs.
 */
export function AdminOverviewPanels({
  stats,
  ghlCalendarConfigured,
}: {
  stats: OverviewStats;
  /** Server-side check — the calendar's config never reaches the client. */
  ghlCalendarConfigured: boolean;
}) {
  const [fddLeads, setFddLeads] = useState<FddLeadSummary[] | null>(null);
  const [fddConfig, setFddConfig] = useState<FddConfig | null>(null);
  const [health, setHealth] = useState<CensusDataHealth | null>(null);
  const [resourceCount, setResourceCount] = useState<number | null>(null);
  const [assetCounts, setAssetCounts] = useState<{ configured: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fail = (label: string) => {
      if (!cancelled) setErrors((prev) => [...prev, label]);
    };

    (async () => {
      try {
        const response = await fetch("/api/admin/fdd");
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setFddLeads(data.leads ?? []);
          setFddConfig(data.config ?? null);
        } else fail("FDD requests");
      } catch {
        fail("FDD requests");
      }
    })();

    (async () => {
      try {
        const response = await fetch("/api/admin/census-health");
        const data = await response.json();
        if (cancelled) return;
        if (data.success) setHealth(data.health as CensusDataHealth);
        else fail("census data health");
      } catch {
        fail("census data health");
      }
    })();

    (async () => {
      try {
        const response = await fetch("/api/admin/resources");
        const data = await response.json();
        if (cancelled) return;
        if (data.success) setResourceCount((data.resources ?? []).length);
        else fail("resources");
      } catch {
        fail("resources");
      }
    })();

    (async () => {
      try {
        const response = await fetch("/api/admin/assets");
        const data = await response.json();
        if (cancelled) return;
        if (data.success && data.slots) {
          setAssetCounts({
            configured: Object.keys(data.assets ?? {}).length,
            total: data.slots.length,
          });
        } else fail("brand assets");
      } catch {
        fail("brand assets");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const recentFdd = (fddLeads ?? [])
    .filter((lead) => lead.fdd_requested_at)
    .sort((a, b) => (b.fdd_requested_at ?? "").localeCompare(a.fdd_requested_at ?? ""))
    .slice(0, 5);

  const assetsIncomplete = assetCounts !== null && assetCounts.configured < assetCounts.total;

  return (
    <div className="flex flex-col gap-[26px]">
      {errors.length > 0 && (
        <p
          className="rounded-card border px-3 py-2 text-[13.5px] leading-[1.45]"
          style={{ borderColor: "#fda29b", backgroundColor: SIGNAL.alertTint, color: SIGNAL.alert }}
          role="alert"
        >
          Some panels could not load: {errors.join(", ")}. Refresh to retry.
        </p>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <TopBarStat
          label="Total Investors"
          value={stats.totalInvestors.toLocaleString()}
          color="#16705a"
          footnote={
            <>
              <strong className="font-bold text-success">+{stats.newThisWeek}</strong> this week
            </>
          }
        />
        <TopBarStat
          label="Active Journeys"
          value={stats.activeJourneys.toLocaleString()}
          color={DISCOVERY_STAGES[0].color}
          footnote={
            stats.totalInvestors > 0
              ? `${Math.round((stats.activeJourneys / stats.totalInvestors) * 100)}% of investors`
              : "no investors yet"
          }
        />
        <TopBarStat
          label="FDD Requests"
          value={stats.fddRequested.toLocaleString()}
          color={DISCOVERY_STAGES[2].color}
          footnote={`${stats.fddInFlight} in flight`}
        />
        <TopBarStat
          label="Resources"
          value={resourceCount === null ? "—" : resourceCount.toLocaleString()}
          color="#f5cf49"
          colorValue={false}
          footnote="on the prospect portal"
        />
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <div className="flex flex-col gap-3.5">
          {/* Recent FDD requests */}
          <Panel>
            <PanelHeader
              title="Recent FDD Requests"
              meta={
                <Link href="/advisor/platform/fdd" className="text-[12px] font-bold text-primary hover:underline">
                  View all
                </Link>
              }
            />
            {fddLeads === null ? (
              <p className="py-2 text-[13px] text-muted-foreground">Loading…</p>
            ) : recentFdd.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">No FDD requests yet.</p>
            ) : (
              <div className="mt-1">
                {recentFdd.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex flex-wrap items-center gap-3.5 border-b border-border-soft py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-foreground">
                        {lead.name}
                      </span>
                      <span className="block truncate text-[12px] font-medium text-faint-foreground">
                        {lead.email}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-[12px] font-semibold text-muted-foreground">
                      {formatDateTime(lead.fdd_requested_at)}
                    </span>
                    <StatusPill status={lead.fdd_effective_status} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Census data health */}
          <Panel>
            <PanelHeader
              title="Census Data Health"
              meta={
                <Link
                  href="/advisor/platform/census-health"
                  className="text-[12px] font-bold text-primary hover:underline"
                >
                  Details
                </Link>
              }
            />
            {health === null ? (
              <p className="mt-2 text-[13px] text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-x-[18px] gap-y-3 sm:grid-cols-3">
                  <Fact label="Active ACS vintage" value={health.vintage} />
                  <Fact
                    label="Geography records"
                    value={health.totalGeographyRecords.toLocaleString()}
                  />
                  <Fact
                    label="Demographic records"
                    value={health.totalDemographicRecords.toLocaleString()}
                  />
                  <Fact
                    label="Coverage"
                    value={`${health.coveragePercent}% · ${health.statesCovered}/${health.statesTotal} states`}
                    color={DISCOVERY_STAGES[0].color}
                  />
                  <Fact
                    label="Last successful import"
                    value={
                      health.lastSuccessfulImport
                        ? formatDateTime(health.lastSuccessfulImport.finishedAt)
                        : "Never"
                    }
                  />
                  <Fact
                    label="Import job"
                    value={
                      health.currentJob
                        ? `Running — ${health.currentJob.statesDone}/${health.currentJob.statesTotal} states`
                        : "Idle"
                    }
                    color={health.currentJob ? SIGNAL.warning : SIGNAL.success}
                  />
                </div>
                <div className="mt-[13px] h-1.5 overflow-hidden rounded-[6px] bg-border-soft">
                  <span
                    className="block h-full rounded-[6px]"
                    style={{
                      width: `${health.coveragePercent}%`,
                      backgroundColor: DISCOVERY_STAGES[0].color,
                    }}
                  />
                </div>
                {health.lastFailedImport?.error && (
                  <AccentNote className="mt-3">
                    <p className="text-[12.5px] leading-[1.6] text-[#6b5510]">
                      <strong className="font-bold">Last failure:</strong>{" "}
                      {health.lastFailedImport.error}
                    </p>
                  </AccentNote>
                )}
              </>
            )}
          </Panel>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-3.5">
          <Panel>
            <p className="text-[15px] font-bold text-foreground">Quick Actions</p>
            <div className="mt-1 flex flex-col text-[13.5px] font-semibold text-foreground">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-2.5 border-b border-border-soft py-[9px] last:border-b-0 hover:text-primary"
                >
                  {action.label}
                  <span aria-hidden className="ml-auto text-primary">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel>
            <p className="text-[15px] font-bold text-foreground">Portal Assets</p>
            <div className="mt-1 flex flex-col text-[13.5px]">
              <LeaderRow
                label={
                  <Link href="/advisor/platform/resources" className="font-semibold text-foreground hover:underline">
                    Resources
                  </Link>
                }
                value={
                  <span className="tabular font-semibold text-muted-foreground">
                    {resourceCount === null
                      ? "…"
                      : `${resourceCount} file${resourceCount === 1 ? "" : "s"}`}
                  </span>
                }
              />
              <LeaderRow
                label={
                  <Link href="/advisor/platform/branding" className="font-semibold text-foreground hover:underline">
                    Brand assets
                  </Link>
                }
                value={
                  assetCounts === null ? (
                    <span className="tabular font-semibold text-muted-foreground">…</span>
                  ) : (
                    <Pill tone={assetsIncomplete ? "warning" : "success"}>
                      {assetCounts.configured}/{assetCounts.total} configured
                    </Pill>
                  )
                }
              />
            </div>
          </Panel>

          <Panel>
            <p className="text-[15px] font-bold text-foreground">Integrations</p>
            {fddConfig === null ? (
              <p className="py-2 text-[13px] text-muted-foreground">Loading…</p>
            ) : (
              <div className="mt-1 flex flex-col text-[13.5px]">
                <IntegrationRow
                  ok={fddConfig.ghlConfigured}
                  label="GoHighLevel"
                  value={fddConfig.ghlConfigured ? "Connected" : "Not configured"}
                />
                <IntegrationRow
                  ok={fddConfig.webhookSecretConfigured}
                  label="FDD webhook secret"
                  value={fddConfig.webhookSecretConfigured ? "Set" : "Not set"}
                />
                <IntegrationRow
                  ok={ghlCalendarConfigured}
                  label="GHL calendar"
                  value={ghlCalendarConfigured ? "Connected" : "Not configured"}
                />
                <IntegrationRow
                  ok
                  label="FDD waiting period"
                  value={`${fddConfig.waitingPeriodDays} days`}
                  plain
                />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
