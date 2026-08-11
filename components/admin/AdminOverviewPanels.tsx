"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload,
  FolderPlus,
  FlaskConical,
  FileText,
  MapPin,
  Database,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FDD_STATUS_STYLES, type FddLeadSummary } from "@/components/adminSections/FddSection";
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
  { href: "/advisor/platform/resources", label: "Add Resource", icon: FolderPlus },
  { href: "/advisor/platform/branding", label: "Upload Brand Asset", icon: Upload },
  { href: "/advisor/platform/test-leads", label: "Create Test Lead", icon: FlaskConical },
  { href: "/advisor/platform/fdd", label: "Manage FDD Requests", icon: FileText },
  { href: "/advisor/platform/zip-data", label: "Load ZIP Data", icon: MapPin },
  { href: "/advisor/platform/census-health", label: "Census Data Health", icon: Database },
];

function KpiCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-success">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function PanelHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {href && (
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {linkLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`size-2 rounded-full ${ok ? "bg-success" : "bg-warning"}`} aria-hidden />
  );
}

export function AdminOverviewPanels({ stats }: { stats: OverviewStats }) {
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

  return (
    <div className="space-y-5">
      {errors.length > 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          Some panels could not load: {errors.join(", ")}. Refresh to retry.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Investors"
          value={stats.totalInvestors.toLocaleString()}
          sublabel={`+${stats.newThisWeek} this week`}
        />
        <KpiCard
          label="Active Journeys"
          value={stats.activeJourneys.toLocaleString()}
          sublabel={
            stats.totalInvestors > 0
              ? `${Math.round((stats.activeJourneys / stats.totalInvestors) * 100)}% of investors`
              : "no investors yet"
          }
        />
        <KpiCard
          label="FDD Requests"
          value={stats.fddRequested.toLocaleString()}
          sublabel={`${stats.fddInFlight} in flight`}
        />
        <KpiCard
          label="Resources"
          value={resourceCount === null ? "—" : resourceCount.toLocaleString()}
          sublabel="on the prospect portal"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <PanelHeader title="Recent FDD Requests" href="/advisor/platform/fdd" />
            <div className="divide-y divide-border-soft">
              {fddLeads === null ? (
                <p className="px-5 py-4 text-xs text-muted-foreground">Loading…</p>
              ) : recentFdd.length === 0 ? (
                <p className="px-5 py-4 text-xs text-muted-foreground">No FDD requests yet.</p>
              ) : (
                recentFdd.map((lead) => (
                  <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(lead.fdd_requested_at)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${FDD_STATUS_STYLES[lead.fdd_effective_status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {lead.fdd_effective_status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="Census Data Health" href="/advisor/platform/census-health" linkLabel="Details" />
            <div className="px-5 py-4">
              {health === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Active ACS vintage</dt>
                      <dd className="text-sm font-medium text-foreground">{health.vintage}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Geography records</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {health.totalGeographyRecords.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Demographic records</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {health.totalDemographicRecords.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Coverage</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {health.coveragePercent}% · {health.statesCovered}/{health.statesTotal} states
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Last successful import</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {health.lastSuccessfulImport
                          ? formatDateTime(health.lastSuccessfulImport.finishedAt)
                          : "Never"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Import job</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {health.currentJob
                          ? `Running — ${health.currentJob.statesDone}/${health.currentJob.statesTotal} states`
                          : "Idle"}
                      </dd>
                    </div>
                  </dl>
                  {health.lastFailedImport?.error && (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Last failure: {health.lastFailedImport.error}
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <PanelHeader title="Quick Actions" />
            <div className="p-3">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href + action.label}
                    href={action.href}
                    className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    {action.label}
                    <ArrowRight className="ml-auto size-3.5 text-faint-foreground" />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="Portal Assets" />
            <div className="divide-y divide-border-soft">
              <Link
                href="/advisor/platform/resources"
                className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surface"
              >
                <span className="font-medium text-foreground">Resources</span>
                <span className="text-xs text-muted-foreground">
                  {resourceCount === null ? "…" : `${resourceCount} file${resourceCount === 1 ? "" : "s"}`}
                </span>
              </Link>
              <Link
                href="/advisor/platform/branding"
                className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surface"
              >
                <span className="font-medium text-foreground">Brand Assets</span>
                <span className="text-xs text-muted-foreground">
                  {assetCounts === null ? "…" : `${assetCounts.configured}/${assetCounts.total} configured`}
                </span>
              </Link>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <PanelHeader title="Integrations" />
            <div className="space-y-2.5 px-5 py-4 text-sm">
              {fddConfig === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <p className="flex items-center gap-2">
                    <StatusDot ok={fddConfig.ghlConfigured} />
                    <span className="text-secondary-foreground">GoHighLevel</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fddConfig.ghlConfigured ? "Connected" : "Not configured"}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <StatusDot ok={fddConfig.webhookSecretConfigured} />
                    <span className="text-secondary-foreground">FDD webhook secret</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fddConfig.webhookSecretConfigured ? "Set" : "Not set"}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <StatusDot ok />
                    <span className="text-secondary-foreground">FDD waiting period</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fddConfig.waitingPeriodDays} days
                    </span>
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
