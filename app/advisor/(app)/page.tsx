import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, CircleAlert, Mail, Search, Sun, Users } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { buildBriefing } from "@/lib/advisor/briefing";
import { AccentNote, Panel, PanelHeader, V3Page } from "@/components/advisor/v3";
import { SECONDARY_BUTTON } from "@/components/advisor/controls";
import {
  ConversionRow,
  MonitorRow,
  PipelineCard,
  QueueRow,
  RangeLabel,
  StatCard,
} from "@/components/advisor/dashboard/overview";

export const metadata: Metadata = { title: "Advisor Dashboard" };
export const dynamic = "force-dynamic";

/** "Tuesday, Aug 27" — the band's dateline. */
function today(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(now);
}

/**
 * The overview (v3 handoff, revised): a green hero band that says what needs
 * attention before anything else, four stat cards, the pipeline as a single
 * card, then the work queue beside the activity monitor and stage conversion.
 */
export default async function AdvisorDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const briefing = buildBriefing(rows);
  const {
    activePipeline,
    newLeads,
    item23Received,
    discoveryDaysScheduled,
    followUps,
    workQueue,
    workQueueDigest,
    bottleneck,
  } = briefing;

  return (
    <V3Page>
      {/* Hero band: the greeting, what needs attention, and the day's tools. */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-[linear-gradient(135deg,#1b7a61,#135c49)] px-[22px] py-5">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <p className="text-[21px] font-extrabold tracking-[-0.01em] text-white">
            Hello, {user.first_name} <span aria-hidden>👋</span>
          </p>
          {/* Only the clauses that are true today — an advisor with a clear
              queue should be told that, not shown a zero. */}
          <p className="text-[13px] font-semibold text-white/85">
            {today(new Date())}
            {followUps.count > 0 && (
              <>
                {" · "}
                <strong className="font-bold text-accent">
                  {followUps.count} overdue follow-up{followUps.count === 1 ? "" : "s"}
                </strong>{" "}
                need{followUps.count === 1 ? "s" : ""} attention
              </>
            )}
            {newLeads.thisWeek > 0 && (
              <>
                {" · "}
                {newLeads.thisWeek} new lead{newLeads.thisWeek === 1 ? "" : "s"} this week
              </>
            )}
            {followUps.count === 0 && newLeads.thisWeek === 0 && " · all clear"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form action="/advisor/investors" method="get" className="hidden md:block">
            <label className="flex min-w-[220px] items-center gap-2 rounded-control border border-white/20 bg-white/[.14] px-[13px] py-2 text-[13px]">
              <Search className="size-3.5 shrink-0 text-white/80" strokeWidth={2} />
              <input
                type="search"
                name="q"
                placeholder="Search leads, clients, tasks…"
                aria-label="Search clients"
                className="w-full bg-transparent text-white placeholder:text-white/60 focus:outline-none"
              />
            </label>
          </form>

          <Link
            href="#queue"
            aria-label={
              followUps.count > 0
                ? `${followUps.count} follow-up${followUps.count === 1 ? "" : "s"} due`
                : "Notifications"
            }
            className="relative flex size-9 items-center justify-center rounded-control border border-white/20 bg-white/[.14] text-white transition-colors hover:bg-white/25"
          >
            <Bell className="size-[15px]" strokeWidth={2} />
            {followUps.count > 0 && (
              <span className="tabular absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-accent px-1.5 text-[10px] font-extrabold leading-none text-accent-foreground">
                {followUps.count}
              </span>
            )}
          </Link>

          <Link
            href="/create-lead"
            className="inline-flex items-center gap-[7px] rounded-control bg-accent px-4 py-[9px] text-[13px] font-bold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            ＋ New Client
          </Link>
        </div>
      </div>

      {/* The four numbers that matter */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          color="#16705a"
          tint="#e7f4ee"
          label="Active Leads"
          period="new this week"
          value={activePipeline.count}
          delta={activePipeline.newThisWeek}
        />
        <StatCard
          icon={Sun}
          color="#b08a15"
          tint="#fff6d9"
          label="New Leads"
          period="this week"
          value={newLeads.count}
          delta={newLeads.thisWeek}
        />
        <StatCard
          icon={Mail}
          color="#0e7490"
          tint="#f0fafb"
          label="Item 23 Received"
          period="this week"
          value={item23Received.count}
          delta={item23Received.thisWeek}
        />
        <StatCard
          icon={CalendarDays}
          color="#16705a"
          tint="#e7f4ee"
          label="Discovery Days Scheduled"
          period="this week"
          value={discoveryDaysScheduled.count}
          delta={discoveryDaysScheduled.thisWeek}
        />
      </div>

      <PipelineCard segments={briefing.pipeline.segments} total={briefing.pipeline.total} />

      <div className="grid items-start gap-3.5 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        {/* Work queue */}
        <Panel id="queue" className="scroll-mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2.5 text-[15px] font-bold text-foreground">
              Work Queue
              {workQueue.length > 0 && (
                <span className="tabular inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-[5px] text-[11px] font-extrabold text-accent-foreground">
                  {workQueue.length}
                </span>
              )}
            </p>
            <Link
              href="/advisor/investors"
              className="text-[12px] font-bold text-primary hover:underline"
            >
              View all tasks
            </Link>
          </div>

          {workQueue.length === 0 ? (
            <p className="py-5 text-[13px] text-muted-foreground">
              Nothing is waiting on you — no follow-ups are due and no client has moved in the last
              24 hours.
            </p>
          ) : (
            <>
              {workQueueDigest.summary && (
                <div className="mt-[11px] flex items-center gap-2.5 rounded-[11px] border border-[#f3d9ce] bg-[#fff8f5] px-[13px] py-2.5">
                  <CircleAlert className="size-[13px] shrink-0 text-[#c2410c]" strokeWidth={2} />
                  <p className="text-[12.5px] font-semibold text-[#8a3a12]">
                    {workQueueDigest.summary}
                  </p>
                </div>
              )}

              <div className="mt-[5px] flex flex-col">
                {workQueue.map((item, index) => (
                  <QueueRow key={item.leadId} item={item} last={index === workQueue.length - 1} />
                ))}
              </div>

              {workQueueDigest.remindAllMailto && (
                <a
                  href={workQueueDigest.remindAllMailto}
                  className={`${SECONDARY_BUTTON} mt-[11px] w-full`}
                >
                  Remind all {workQueue.length}
                </a>
              )}
            </>
          )}
        </Panel>

        {/* Right rail */}
        <div className="flex flex-col gap-3.5">
          <Panel>
            <PanelHeader title="Activity Monitor" meta={<RangeLabel>Last 24 hours</RangeLabel>} />
            {briefing.recentActivity.length === 0 ? (
              <p className="py-4 text-[13px] text-muted-foreground">
                No client activity in the last 24 hours.
              </p>
            ) : (
              <div className="mt-1 flex flex-col">
                {briefing.recentActivity.map((item, index) => (
                  <MonitorRow
                    key={`${item.leadId}-${index}`}
                    item={item}
                    last={index === briefing.recentActivity.length - 1}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Stage Conversion" meta={<RangeLabel>Last 30 days</RangeLabel>} />
            <div className="mt-[13px] flex flex-col gap-[11px]">
              {briefing.conversion.map((step) => (
                <ConversionRow key={step.from.id} step={step} />
              ))}
            </div>
            {bottleneck && (
              <AccentNote className="mt-[13px]">
                <p className="text-[12px] leading-[1.6] text-[#6b5510]">
                  <strong className="font-bold">Bottleneck:</strong> {bottleneck.text}{" "}
                  {bottleneck.advice}
                </p>
              </AccentNote>
            )}
          </Panel>
        </div>
      </div>
    </V3Page>
  );
}
