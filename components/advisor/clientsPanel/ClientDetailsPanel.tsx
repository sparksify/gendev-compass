"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Flame,
  Mail,
  MapPin,
  Pencil,
  Phone,
  X,
  Zap,
} from "lucide-react";
import { MILESTONES, milestoneStatus } from "@/lib/advisor/milestones";
import { cn } from "@/lib/utils";
import type { MilestoneKey, ProcessMilestones } from "@/types/lead";
import { PILL_CLASS, stagePill, type PillTone } from "./pills";

export interface PanelData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  brandName: string | null;
  stage: string;
  isHot: boolean;
  portalUrl: string;
  video: { percent: number; watchTime: string; playCount: number } | null;
  lastActivity: { relative: string; label: string | null };
  nextBestAction: { title: string; sub: string; mailto: string | null };
  financial: { liquidCapital: string; netWorth: string; timeline: string; ownedBusiness: string };
  progress: {
    consultation: { label: string; tone: PillTone };
    fdd: { label: string; tone: PillTone; inFlight: boolean };
    funding: { label: string; tone: PillTone };
    questionnaire: { label: string; tone: PillTone; completed: boolean };
  };
  milestones: ProcessMilestones;
  leadSource: {
    type: "organic" | "broker";
    brokerName: string | null;
    brokerNetwork: string | null;
    brokerEmail: string | null;
    brokerPhone: string | null;
    channel: string | null;
    campaign: string | null;
    medium: string | null;
    landingPage: string | null;
  };
  territoriesWanted: number | null;
  territory: string;
  latestNote: { body: string; author: string; when: string } | null;
  notesCount: number;
}

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        PILL_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-faint-foreground">{children}</p>
      {right}
    </div>
  );
}

function Tile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[11px] border border-border-soft bg-surface-raised p-3", className)}>
      {children}
    </div>
  );
}

const LINK_ACTION = "text-[11.5px] font-bold text-primary hover:underline";

function milestoneAction(key: MilestoneKey, status: string): { label: string; next?: string; href?: string } | null {
  switch (key) {
    case "ops_zoom_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark attended", next: "attended" };
      return null;
    case "founder_intro_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark done", next: "completed" };
      return null;
    case "territory_designed":
      if (status === "not_started") return { label: "Start", next: "in_progress" };
      if (status === "in_progress") return { label: "Review", href: "/advisor/territories" };
      return null;
    case "signing_day":
      if (status === "not_set") return { label: "Set date", next: "scheduled" };
      if (status === "scheduled") return { label: "Mark signed", next: "signed" };
      return null;
  }
}

/**
 * The slide-in Client Details right drawer — everything the old detail page
 * led with, condensed, with sticky Send Email / Call actions. Deep data
 * lives behind "Open full client record".
 */
export function ClientDetailsPanel({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PanelData | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingTerritories, setEditingTerritories] = useState(false);

  async function load(id: string) {
    setError(false);
    try {
      const response = await fetch(`/api/advisor/investors/${id}/panel`);
      const json = (await response.json()) as { success: boolean; panel?: PanelData };
      if (!json.success || !json.panel) throw new Error("load failed");
      setData(json.panel);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    setData(null);
    setEditingTerritories(false);
    void load(clientId);
  }, [clientId]);

  async function sendFdd() {
    if (!data) return;
    setBusy("fdd");
    try {
      await fetch(`/api/advisor/investors/${data.id}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: data.progress.fdd.inFlight }),
      });
      await load(data.id);
    } finally {
      setBusy(null);
    }
  }

  async function advanceMilestone(key: MilestoneKey, next: string) {
    if (!data) return;
    setBusy(key);
    try {
      await fetch(`/api/advisor/investors/${data.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: { [key]: { status: next } } }),
      });
      await load(data.id);
    } finally {
      setBusy(null);
    }
  }

  async function saveTerritories(raw: string) {
    if (!data) return;
    setEditingTerritories(false);
    const next = raw.trim() === "" ? null : Number.parseInt(raw, 10);
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 999)) return;
    setBusy("territories");
    try {
      await fetch(`/api/advisor/investors/${data.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territoriesWanted: next }),
      });
      await load(data.id);
    } finally {
      setBusy(null);
    }
  }

  const stage = data ? stagePill(data.stage) : null;
  const cqMailto = data
    ? `mailto:${data.email}?subject=${encodeURIComponent("Your client questionnaire")}&body=${encodeURIComponent(
        `Hi,\n\nWhen you have a few minutes, please complete your client questionnaire here:\n${data.portalUrl}/questionnaire\n\nThank you!`,
      )}`
    : "#";

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[15px] font-extrabold text-foreground">Client Details</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close client details"
          className="flex size-[30px] items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-[#f1f5fb] hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
        {error && (
          <p className="text-[13px] text-destructive">
            Could not load this client.{" "}
            <button type="button" className="font-semibold underline" onClick={() => load(clientId)}>
              Retry
            </button>
          </p>
        )}
        {!data && !error && <p className="text-[13px] text-muted-foreground">Loading…</p>}
        {data && stage && (
          <div className="space-y-4">
            {/* Identity */}
            <div className="flex items-start gap-3">
              <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#2463eb)] text-lg font-bold text-white">
                {data.name
                  .split(" ")
                  .map((part) => part.charAt(0))
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="text-[16.5px] font-extrabold leading-tight text-foreground">{data.name}</p>
                {data.brandName && (
                  <p className="truncate text-[12.5px] font-semibold text-primary">{data.brandName}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill tone={stage.tone}>{stage.label}</Pill>
                  {data.isHot && (
                    <Pill tone="hot">
                      <Flame className="size-[11px]" />
                      Hot lead
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            {/* Contact rows */}
            <div className="space-y-1.5">
              <a
                href={`mailto:${data.email}`}
                className="flex items-center gap-2 text-[13px] font-semibold text-secondary-foreground hover:text-primary"
              >
                <Mail className="size-[15px] text-faint-foreground" />
                <span className="truncate">{data.email}</span>
              </a>
              {data.phone && (
                <a
                  href={`tel:${data.phone}`}
                  className="flex items-center gap-2 text-[13px] font-semibold text-secondary-foreground hover:text-primary"
                >
                  <Phone className="size-[15px] text-faint-foreground" />
                  {data.phone}
                </a>
              )}
            </div>

            {/* Tile pair: video + last activity */}
            <div className="grid grid-cols-2 gap-2.5">
              <Tile>
                <p className="text-[10.5px] font-semibold text-faint-foreground">Video watched</p>
                {data.video ? (
                  <>
                    <p className="mt-0.5 text-sm font-extrabold text-foreground">
                      {Math.round(data.video.percent)}%
                      <span className="ml-1 text-[10.5px] font-semibold text-muted-foreground">
                        {data.video.watchTime} · {data.video.playCount} play
                        {data.video.playCount === 1 ? "" : "s"}
                      </span>
                    </p>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#e8eef8]">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(data.video.percent)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">No activity</p>
                )}
              </Tile>
              <Tile>
                <p className="text-[10.5px] font-semibold text-faint-foreground">Last activity</p>
                <p className="mt-0.5 text-sm font-extrabold text-foreground">{data.lastActivity.relative}</p>
                {data.lastActivity.label && (
                  <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                    {data.lastActivity.label}
                  </p>
                )}
              </Tile>
            </div>

            {/* Next best action strip */}
            <div className="flex items-center gap-2.5 rounded-[11px] bg-[linear-gradient(135deg,#3b82f6,#2463eb)] px-3.5 py-3">
              <Zap className="size-4 shrink-0 text-white" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-white">{data.nextBestAction.title}</p>
                <p className="truncate text-[11px] text-[#cdddff]">{data.nextBestAction.sub}</p>
              </div>
              {data.nextBestAction.mailto && (
                <a
                  href={data.nextBestAction.mailto}
                  className="shrink-0 rounded-[8px] bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-primary hover:bg-[#eff4ff]"
                >
                  Remind
                </a>
              )}
            </div>

            {/* Financial profile */}
            <div>
              <SectionLabel>Financial profile</SectionLabel>
              <Tile className="mt-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    ["Liquid capital", data.financial.liquidCapital],
                    ["Net worth", data.financial.netWorth],
                    ["Timeline", data.financial.timeline],
                    ["Owned a business", data.financial.ownedBusiness],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[10.5px] font-semibold text-faint-foreground">{label}</p>
                      <p className="truncate text-[12.5px] font-bold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </Tile>
            </div>

            {/* Client progress */}
            <div>
              <SectionLabel>Client progress</SectionLabel>
              <div className="mt-1">
                {(
                  [
                    {
                      key: "consultation",
                      label: "Consultation",
                      pill: data.progress.consultation,
                      action: (
                        <a
                          href={`${data.portalUrl}/schedule`}
                          target="_blank"
                          rel="noreferrer"
                          className={LINK_ACTION}
                        >
                          Schedule
                        </a>
                      ),
                    },
                    {
                      key: "fdd",
                      label: "FDD",
                      pill: data.progress.fdd,
                      action: (
                        <button
                          type="button"
                          onClick={sendFdd}
                          disabled={busy === "fdd"}
                          className={cn(LINK_ACTION, "disabled:opacity-50")}
                        >
                          {busy === "fdd" ? "Sending…" : data.progress.fdd.inFlight ? "Resend FDD" : "Send FDD"}
                        </button>
                      ),
                    },
                    {
                      key: "funding",
                      label: "Funding profile",
                      pill: data.progress.funding,
                      action: (
                        <Link href={`/advisor/investors/${data.id}`} aria-label="Open funding detail">
                          <ChevronRight className="size-3.5 text-faint-foreground" />
                        </Link>
                      ),
                    },
                    {
                      key: "questionnaire",
                      label: "Questionnaire",
                      pill: data.progress.questionnaire,
                      action: data.progress.questionnaire.completed ? (
                        <Link href={`/advisor/investors/${data.id}#questionnaire-responses`} className={LINK_ACTION}>
                          View
                        </Link>
                      ) : (
                        <a href={cqMailto} className={LINK_ACTION}>
                          Send CQ link
                        </a>
                      ),
                    },
                  ] as const
                ).map((row, index, all) => (
                  <div
                    key={row.key}
                    className={cn(
                      "flex items-center justify-between gap-2 py-2",
                      index !== all.length - 1 && "border-b border-[#f1f5f9]",
                    )}
                  >
                    <span className="text-[13px] font-semibold text-foreground">{row.label}</span>
                    <span className="flex items-center gap-2.5">
                      <Pill tone={row.pill.tone}>{row.pill.label}</Pill>
                      {row.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Process milestones */}
            <div>
              <SectionLabel
                right={
                  <Pill tone="blue">
                    {MILESTONES.filter((def) => milestoneStatus(data.milestones, def).complete).length} of 4
                  </Pill>
                }
              >
                Process milestones
              </SectionLabel>
              <div className="mt-1">
                {MILESTONES.map((def, index) => {
                  const current = milestoneStatus(data.milestones, def);
                  const action = milestoneAction(def.key, current.value);
                  const StateIcon = current.complete
                    ? CheckCircle2
                    : current.tone === "amber"
                      ? Clock
                      : Circle;
                  return (
                    <div
                      key={def.key}
                      className={cn(
                        "flex items-center justify-between gap-2 py-2",
                        index !== MILESTONES.length - 1 && "border-b border-[#f1f5f9]",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <StateIcon
                          className={cn(
                            "size-4 shrink-0",
                            current.complete
                              ? "text-[#16a34a]"
                              : current.tone === "amber"
                                ? "text-[#b45309]"
                                : "text-[#cbd5e1]",
                          )}
                        />
                        <span className="truncate text-[13px] font-semibold text-foreground">{def.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {(current.complete || current.tone === "amber") && (
                          <Pill tone={current.complete ? "green" : "amber"}>{current.label}</Pill>
                        )}
                        {action &&
                          (action.href ? (
                            <Link href={action.href} className={LINK_ACTION}>
                              {action.label}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => advanceMilestone(def.key, action.next!)}
                              disabled={busy === def.key}
                              className={cn(LINK_ACTION, "disabled:opacity-50")}
                            >
                              {action.label}
                            </button>
                          ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead source */}
            <div>
              <SectionLabel
                right={
                  data.leadSource.type === "broker" ? (
                    <Pill tone="purple">Broker</Pill>
                  ) : (
                    <Pill tone="green">Organic</Pill>
                  )
                }
              >
                Lead source
              </SectionLabel>
              <Tile className="mt-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {(data.leadSource.type === "broker"
                    ? ([
                        ["Broker", data.leadSource.brokerName, null],
                        ["Network", data.leadSource.brokerNetwork, null],
                        [
                          "Email",
                          data.leadSource.brokerEmail,
                          data.leadSource.brokerEmail ? `mailto:${data.leadSource.brokerEmail}` : null,
                        ],
                        [
                          "Phone",
                          data.leadSource.brokerPhone,
                          data.leadSource.brokerPhone ? `tel:${data.leadSource.brokerPhone}` : null,
                        ],
                      ] as const)
                    : ([
                        ["Channel", data.leadSource.channel, null],
                        ["Campaign", data.leadSource.campaign, null],
                        ["Medium", data.leadSource.medium, null],
                        ["Landing page", data.leadSource.landingPage, null],
                      ] as const)
                  ).map(([label, value, link]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[10.5px] font-semibold text-faint-foreground">{label}</p>
                      {value ? (
                        link ? (
                          <a href={link} className="block truncate text-[12.5px] font-bold text-primary hover:underline">
                            {value}
                          </a>
                        ) : (
                          <p className="truncate text-[12.5px] font-bold text-foreground">{value}</p>
                        )
                      ) : (
                        <p className="text-[12.5px] text-[#cbd5e1]">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </Tile>
            </div>

            {/* Territory */}
            <div className="grid grid-cols-2 gap-2.5">
              <Tile>
                <p className="text-[10.5px] font-semibold text-faint-foreground">Territories wanted</p>
                {editingTerritories ? (
                  <input
                    type="number"
                    min={0}
                    max={999}
                    autoFocus
                    defaultValue={data.territoriesWanted ?? ""}
                    aria-label="Territories wanted"
                    onBlur={(e) => saveTerritories(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingTerritories(false);
                    }}
                    className="mt-0.5 w-16 rounded-md border border-primary bg-card px-1.5 py-0.5 text-base font-extrabold text-foreground focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTerritories(true)}
                    className="mt-0.5 inline-flex items-baseline gap-1 text-base font-extrabold text-foreground hover:text-primary"
                  >
                    {data.territoriesWanted ?? "—"}
                    <span className="text-[11px] font-semibold text-muted-foreground">units</span>
                    <Pencil className="size-[11px] self-center text-faint-foreground" />
                  </button>
                )}
                <p className="mt-0.5 text-[10.5px] text-faint-foreground">Advisor estimate</p>
              </Tile>
              <Tile>
                <p className="text-[10.5px] font-semibold text-faint-foreground">Primary territory</p>
                <p className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold text-foreground">
                  <MapPin className="size-3.5 shrink-0 text-faint-foreground" />
                  <span className="truncate">{data.territory}</span>
                </p>
                <Link href="/advisor/territories" className="mt-0.5 inline-block text-[11px] font-bold text-primary hover:underline">
                  Territory insights
                </Link>
              </Tile>
            </div>

            {/* Latest note */}
            <div>
              <SectionLabel
                right={
                  <Link href={`/advisor/investors/${data.id}#advisor-notes`} className={LINK_ACTION}>
                    All notes ({data.notesCount})
                  </Link>
                }
              >
                Latest note
              </SectionLabel>
              {data.latestNote ? (
                <Tile className="mt-2">
                  <p className="whitespace-pre-wrap text-[12.5px] leading-normal text-secondary-foreground">
                    {data.latestNote.body}
                  </p>
                  <p className="mt-1.5 text-[10.5px] font-semibold text-faint-foreground">
                    {data.latestNote.author} · {data.latestNote.when}
                  </p>
                </Tile>
              ) : (
                <p className="mt-2 text-[12.5px] text-muted-foreground">No notes yet.</p>
              )}
            </div>

            <Link
              href={`/advisor/investors/${data.id}`}
              className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary hover:underline"
            >
              Open full client record
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
          <a
            href={`mailto:${data.email}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-primary px-3 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_6px_rgb(36_99_235/0.3)] transition-colors hover:bg-primary-hover"
          >
            <Mail className="size-4" />
            Send Email
          </a>
          <a
            href={data.phone ? `tel:${data.phone}` : undefined}
            aria-disabled={!data.phone}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-border bg-card px-3 py-2.5 text-[13px] font-bold text-foreground transition-colors",
              data.phone ? "hover:border-primary hover:text-primary" : "pointer-events-none opacity-50",
            )}
          >
            <Phone className="size-4" />
            Call
          </a>
          <a
            href={data.portalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open portal"
            title="Open portal"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
    </div>
  );
}
