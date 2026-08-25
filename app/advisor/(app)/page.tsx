import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { buildBriefing } from "@/lib/advisor/briefing";
import { discoveryStageFor, DISCOVERY_STAGES, SIGNAL } from "@/lib/advisor/discoveryStages";
import { fetchGhlCalendarEventsForDay, isGhlCalendarConfigured } from "@/lib/calendar/ghl";
import { PageBody, PageHeader, SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON } from "@/components/advisor/controls";
import {
  ActivityList,
  ConversionList,
  MetricRule,
  PipelineBar,
  ScheduleRow,
  WorkQueueRow,
} from "@/components/advisor/dashboard/panels";

export const metadata: Metadata = { title: "Advisor Dashboard" };
export const dynamic = "force-dynamic";

function timeOfDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

/**
 * The daily briefing (handoff mock 6a): four metric rules, the discovery
 * funnel, the work queue, and a right rail of today's schedule, stage
 * conversion, and the last 24 hours.
 */
export default async function AdvisorDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const now = new Date();
  const briefing = buildBriefing(rows, now);

  const calendar = isGhlCalendarConfigured()
    ? await fetchGhlCalendarEventsForDay(now)
    : { attempted: false, configured: false, events: [], error: null };
  const rowByEmail = new Map(rows.map((row) => [row.lead.email.toLowerCase(), row]));

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
  const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(now);

  const { activePipeline, bookingRate, videoWatch, followUps } = briefing;

  return (
    <>
      <PageHeader
        title={`${weekday} briefing`}
        subtitle={<span className="tabular">{dateLabel}</span>}
        actions={
          <>
            <form action="/advisor/investors" method="get" className="hidden sm:block">
              <label className="flex w-[270px] items-center gap-2 rounded-control border border-border px-[11px] py-[7px] text-[12.5px]">
                <Search className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={2} />
                <input
                  type="search"
                  name="q"
                  placeholder="Search…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-foreground placeholder:text-faint-foreground focus:outline-none"
                />
              </label>
            </form>
            <Link href="/create-lead" className={INK_BUTTON}>
              New client
            </Link>
          </>
        }
      />

      <PageBody className="flex flex-col gap-[26px]">
        {/* Metric row */}
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <MetricRule
            label="Active pipeline"
            value={String(activePipeline.count)}
            color="#101828"
            footnote={
              <>
                <strong className="font-bold text-foreground">+{activePipeline.newThisWeek}</strong> new
                this week
              </>
            }
          />
          <MetricRule
            label="Booked / 100 visitors"
            value={bookingRate.per100 === null ? "—" : bookingRate.per100.toFixed(1)}
            color={DISCOVERY_STAGES[1].color}
            footnote={
              bookingRate.delta === null ? (
                "not enough history yet"
              ) : (
                <>
                  <strong
                    className="font-bold"
                    style={{ color: bookingRate.delta >= 0 ? SIGNAL.success : SIGNAL.alert }}
                  >
                    {bookingRate.delta >= 0 ? "↑" : "↓"} {Math.abs(bookingRate.delta).toFixed(1)}
                  </strong>{" "}
                  vs last week
                </>
              )
            }
          />
          <MetricRule
            label="Avg video watch"
            value={videoWatch.averagePercent === null ? "—" : `${videoWatch.averagePercent}%`}
            color={DISCOVERY_STAGES[0].color}
            footnote={`${videoWatch.completed} completed the overview`}
          />
          <MetricRule
            label="Follow-ups due"
            value={String(followUps.count)}
            color={SIGNAL.alert}
            labelColor={SIGNAL.alert}
            footnote={
              followUps.oldestDays === null
                ? "nothing waiting"
                : `oldest waiting ${followUps.oldestDays} day${followUps.oldestDays === 1 ? "" : "s"}`
            }
          />
        </div>

        {/* Discovery pipeline */}
        <div>
          <SectionRule
            label="Discovery pipeline"
            meta={<span className="tabular">{briefing.pipeline.total} clients</span>}
            className="mb-3"
          />
          <PipelineBar segments={briefing.pipeline.segments} />
        </div>

        <div className="grid gap-10 xl:grid-cols-[1.5fr_1fr] xl:gap-11">
          {/* Work queue */}
          <div>
            <SectionRule
              label="Work queue"
              meta={<span className="tabular">{briefing.workQueue.length} open</span>}
              className="mb-1.5"
            />
            {briefing.workQueue.length === 0 ? (
              <p className="py-4 text-[12.5px] text-muted-foreground">
                Nothing is waiting on you — no follow-ups are due and no client has moved in the last
                24 hours.
              </p>
            ) : (
              briefing.workQueue.map((item, index) => (
                <WorkQueueRow key={item.leadId} item={item} primary={index === 0} />
              ))
            )}
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-[26px]">
            <div>
              <SectionRule label="Schedule" meta={shortDate} className="mb-1" />
              {!calendar.configured ? (
                <p className="py-2 text-[12.5px] text-muted-foreground">
                  Calendar not connected — set <code className="text-[11.5px]">GHL_CALENDAR_ID</code>{" "}
                  to show today&rsquo;s bookings here.
                </p>
              ) : calendar.error ? (
                <p className="py-2 text-[12.5px] text-destructive">
                  Couldn&rsquo;t load the calendar: {calendar.error}
                </p>
              ) : calendar.events.length === 0 ? (
                <p className="py-2 text-[12.5px] text-muted-foreground">No calls scheduled today.</p>
              ) : (
                calendar.events.map((event) => {
                  const match = event.contactEmail
                    ? rowByEmail.get(event.contactEmail.toLowerCase())
                    : undefined;
                  const stage = match ? discoveryStageFor(match.stage) : null;
                  return (
                    <ScheduleRow
                      key={event.id}
                      time={timeOfDay(event.startTime)}
                      name={match ? `${match.lead.first_name} ${match.lead.last_name}` : event.title}
                      typeLabel={stage?.short ?? "Consultation"}
                      typeColor={stage?.color ?? SIGNAL.neutral}
                      href={match ? `/advisor/investors/${match.lead.id}` : null}
                    />
                  );
                })
              )}
            </div>

            <div>
              <SectionRule label="Stage conversion" meta="last 30 days" className="mb-3" />
              <ConversionList steps={briefing.conversion} />
            </div>

            <div>
              <SectionRule label="Last 24 hours" className="mb-1.5" />
              <ActivityList
                items={briefing.recentActivity}
                emptyMessage="No client activity in the last 24 hours."
              />
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
