import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, Mail, Search, Sparkles, Users } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { buildBriefing } from "@/lib/advisor/briefing";
import { Overline, Panel, PanelHeader, PageTitle, V3Page } from "@/components/advisor/v3";
import { ACCENT_BUTTON } from "@/components/advisor/controls";
import {
  ConversionRow,
  CountTitle,
  MonitorRow,
  QueueRow,
  RangeLabel,
  StageCard,
  StatCard,
} from "@/components/advisor/dashboard/overview";

export const metadata: Metadata = { title: "Advisor Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The overview (v3 handoff): a greeting header carrying search, alerts and the
 * one yellow action, four stat cards, the five pipeline-stage cards, then the
 * work queue beside the activity monitor and stage conversion.
 */
export default async function AdvisorDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const briefing = buildBriefing(rows);
  const { activePipeline, newLeads, item23Received, discoveryDaysScheduled, followUps } = briefing;

  return (
    <V3Page>
      <PageTitle
        stacked
        title={`Hello, ${user.first_name}`}
        meta="Here's what's happening with your pipeline today."
        actions={
          <>
            <form action="/advisor/investors" method="get" className="hidden md:block">
              <label className="flex w-[250px] items-center gap-2 rounded-control border border-border bg-card px-[13px] py-2 text-[13px]">
                <Search className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={2} />
                <input
                  type="search"
                  name="q"
                  placeholder="Search leads, clients, tasks…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-foreground placeholder:text-[#8b968f] focus:outline-none"
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
              className="relative flex size-9 items-center justify-center rounded-control border border-border bg-card text-secondary-foreground transition-colors hover:bg-surface-raised"
            >
              <Bell className="size-[15px]" strokeWidth={2} />
              {followUps.count > 0 && (
                <span className="tabular absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-[#c2410c] px-[5px] text-[9.5px] font-extrabold leading-none text-white">
                  {followUps.count}
                </span>
              )}
            </Link>
            <Link href="/create-lead" className={ACCENT_BUTTON}>
              ＋ New Client
            </Link>
          </>
        }
      />

      {/* The four numbers that matter */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          color="#16705a"
          tint="#e7f4ee"
          label="Active Leads"
          value={activePipeline.count}
          delta={`+${activePipeline.newThisWeek} new this week`}
          positive={activePipeline.newThisWeek > 0}
        />
        <StatCard
          icon={Sparkles}
          color="#b08a18"
          tint="#fff6d9"
          label="New Leads"
          value={newLeads.count}
          delta={`+${newLeads.thisWeek} this week`}
          positive={newLeads.thisWeek > 0}
        />
        <StatCard
          icon={Mail}
          color="#b45309"
          tint="#fff4e5"
          label="Item 23 Received"
          value={item23Received.count}
          delta={`+${item23Received.thisWeek} this week`}
          positive={item23Received.thisWeek > 0}
        />
        <StatCard
          icon={CalendarDays}
          color="#16705a"
          tint="#e7f4ee"
          label="Discovery Days Scheduled"
          value={discoveryDaysScheduled.count}
          delta={`+${discoveryDaysScheduled.thisWeek} this week`}
          positive={discoveryDaysScheduled.thisWeek > 0}
        />
      </div>

      {/* Pipeline stages */}
      <div>
        <Overline className="mb-[9px]">Pipeline Stages</Overline>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {briefing.pipeline.segments.map((segment) => (
            <StageCard key={segment.stage.id} segment={segment} total={briefing.pipeline.total} />
          ))}
        </div>
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        {/* Work queue */}
        <Panel id="queue" className="scroll-mt-4">
          <PanelHeader
            align="center"
            title={<CountTitle label="Work Queue" count={briefing.workQueue.length} />}
            meta={
              <Link
                href="/advisor/investors"
                className="text-[12.5px] font-bold text-primary hover:underline"
              >
                View all tasks
              </Link>
            }
          />
          {briefing.workQueue.length === 0 ? (
            <p className="py-5 text-[13px] text-muted-foreground">
              Nothing is waiting on you — no follow-ups are due and no client has moved in the last
              24 hours.
            </p>
          ) : (
            <div className="mt-1.5">
              {briefing.workQueue.map((item, index) => (
                <QueueRow
                  key={item.leadId}
                  item={item}
                  last={index === briefing.workQueue.length - 1}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Right rail */}
        <div className="flex flex-col gap-3.5">
          <Panel>
            <PanelHeader
              align="center"
              title="Activity Monitor"
              meta={<RangeLabel>Last 24 hours</RangeLabel>}
            />
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
            <PanelHeader
              align="center"
              title="Stage Conversion"
              meta={<RangeLabel>Last 30 days</RangeLabel>}
            />
            <div className="mt-1 flex flex-col">
              {briefing.conversion.map((step) => (
                <ConversionRow key={step.from.id} step={step} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </V3Page>
  );
}
