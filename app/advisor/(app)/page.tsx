import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, Mail, Plus, Search, Sparkles, Users, WandSparkles } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { buildBriefing } from "@/lib/advisor/briefing";
import { SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON } from "@/components/advisor/controls";
import {
  Card,
  ConversionRow,
  MonitorRow,
  PanelHeader,
  QueueRow,
  RangeLabel,
  StageCard,
  StatCard,
} from "@/components/advisor/dashboard/overview";

export const metadata: Metadata = { title: "Advisor Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The overview (uploaded dashboard mock): greeting header with search and
 * alerts, four icon stat cards, the five pipeline-stage cards, then the work
 * queue beside the activity monitor and stage conversion — hairline-bordered
 * sections on the same white canvas as the rest of the app. This page
 * carries its own header; the shared PageHeader belongs to the other pages.
 */
export default async function AdvisorDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const briefing = buildBriefing(rows);
  const { activePipeline, newLeads, item23Received, discoveryDaysScheduled, followUps } = briefing;

  return (
    <main className="flex-1 px-5 py-6 lg:px-9 lg:py-8">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-7">
        {/* Greeting + search, alerts, new client */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold tracking-[-0.03em] text-foreground">
              Hello, {user.first_name}
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              Here&rsquo;s what&rsquo;s happening with your pipeline today.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <form action="/advisor/investors" method="get" className="hidden md:block">
              <label className="flex w-[290px] items-center gap-2.5 rounded-control border border-border bg-card px-3.5 py-[9px] text-[14px]">
                <Search className="size-4 shrink-0 text-faint-foreground" strokeWidth={2} />
                <input
                  type="search"
                  name="q"
                  placeholder="Search leads, clients, tasks…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-foreground placeholder:text-faint-foreground focus:outline-none"
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
              className="relative rounded-full p-2 text-secondary-foreground transition-colors hover:bg-surface-raised"
            >
              <Bell className="size-[19px]" strokeWidth={1.8} />
              {followUps.count > 0 && (
                <span className="tabular absolute -right-px -top-px flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10.5px] font-bold leading-none text-white">
                  {followUps.count}
                </span>
              )}
            </Link>
            <Link href="/create-lead" className={INK_BUTTON}>
              <Plus className="size-4" strokeWidth={2.2} />
              New client
            </Link>
          </div>
        </div>

        {/* The four numbers that matter */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            color="#4f46e5"
            tint="#eef2ff"
            label="Active Leads"
            value={activePipeline.count}
            delta={`+ ${activePipeline.newThisWeek} new this week`}
          />
          <StatCard
            icon={Sparkles}
            color="#2463eb"
            tint="#eff4ff"
            label="New Leads"
            value={newLeads.count}
            delta={`+ ${newLeads.thisWeek} this week`}
          />
          <StatCard
            icon={Mail}
            color="#d97706"
            tint="#fdf3e6"
            label="Item 23 Received"
            value={item23Received.count}
            delta={`+ ${item23Received.thisWeek} this week`}
          />
          <StatCard
            icon={CalendarDays}
            color="#15803d"
            tint="#ecf9f1"
            label="Discovery Days Scheduled"
            value={discoveryDaysScheduled.count}
            delta={`+ ${discoveryDaysScheduled.thisWeek} this week`}
          />
        </div>

        {/* Pipeline stages */}
        <div>
          <SectionRule label="Pipeline stages" className="mb-3.5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {briefing.pipeline.segments.map((segment) => (
              <StageCard key={segment.stage.id} segment={segment} total={briefing.pipeline.total} />
            ))}
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
          {/* Work queue */}
          <Card id="queue" className="px-5 pb-3 pt-[18px]">
            <PanelHeader
              label="Work queue"
              chip={briefing.workQueue.length}
              right={
                <Link
                  href="/advisor/investors"
                  className="text-[13.5px] font-semibold text-[#2463eb] hover:underline"
                >
                  View all tasks
                </Link>
              }
            />
            {briefing.workQueue.length === 0 ? (
              <p className="py-5 text-[14px] text-muted-foreground">
                Nothing is waiting on you — no follow-ups are due and no client has moved in the
                last 24 hours.
              </p>
            ) : (
              <div className="mt-1.5">
                {briefing.workQueue.map((item) => (
                  <QueueRow key={item.leadId} item={item} />
                ))}
              </div>
            )}
          </Card>

          {/* Right rail */}
          <div className="flex flex-col gap-5">
            <Card className="px-5 pb-3.5 pt-[18px]">
              <PanelHeader label="Activity monitor" right={<RangeLabel>Last 24 hours</RangeLabel>} />
              {briefing.recentActivity.length === 0 ? (
                <p className="py-4 text-[14px] text-muted-foreground">
                  No client activity in the last 24 hours.
                </p>
              ) : (
                <div className="mt-2 flex flex-col">
                  {briefing.recentActivity.map((item, index) => (
                    <MonitorRow key={`${item.leadId}-${index}`} item={item} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="px-5 pb-3.5 pt-[18px]">
              <PanelHeader label="Stage conversion" right={<RangeLabel>Last 30 days</RangeLabel>} />
              <div className="mt-2 flex flex-col">
                {briefing.conversion.map((step) => (
                  <ConversionRow key={step.from.id} step={step} />
                ))}
              </div>
            </Card>
          </div>
        </div>

        <p className="flex items-center justify-center gap-2.5 pb-2 pt-1 text-[14px] text-muted-foreground">
          <WandSparkles aria-hidden className="size-[18px] text-[#6d28d9]" strokeWidth={1.8} />
          You&rsquo;re all caught up! Check back later for new insights.
        </p>
      </div>
    </main>
  );
}
