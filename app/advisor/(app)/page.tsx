import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { InvestorTable } from "@/components/advisor/InvestorTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, ghlAppointmentStatusLabel } from "@/lib/advisor/format";
import { fetchGhlCalendarEventsForDay, isGhlCalendarConfigured } from "@/lib/calendar/ghl";

export const metadata: Metadata = { title: "Advisor Dashboard" };
export const dynamic = "force-dynamic";

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-border-strong">
        <CardContent className="p-4">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function withinHours(iso: string | null | undefined, hours: number, now: Date): boolean {
  if (!iso) return false;
  return now.getTime() - new Date(iso).getTime() <= hours * 3_600_000;
}

export default async function AdvisorDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const now = new Date();

  const emailToLead = new Map(rows.map((r) => [r.lead.email.toLowerCase(), r]));
  const calendarConfigured = isGhlCalendarConfigured();
  const calendar = calendarConfigured
    ? await fetchGhlCalendarEventsForDay(now)
    : { attempted: false, configured: false, events: [], error: null };

  const newLast7d = rows.filter((r) => withinHours(r.lead.created_at, 7 * 24, now));
  const questionnairesCompleted = rows.filter((r) => r.lead.questionnaire_completed_at);
  const consultationsScheduled = rows.filter(
    (r) => r.activeAppointment || (r.lead.booked_at && !r.appointments.some((a) => a.status === "COMPLETED")),
  );
  const fddInFlight = rows.filter(
    (r) =>
      r.fddStatus !== "not_requested" &&
      r.fddStatus !== "fdd_received" &&
      r.fddStatus !== "waiting_period_active" &&
      r.fddStatus !== "eligible_for_agreement",
  );
  const needsFollowUp = rows.filter((r) => r.followUp.needed);

  const questionnairesLast24h = rows.filter((r) =>
    withinHours(r.lead.questionnaire_completed_at, 24, now),
  );
  const fddRequestsLast24h = rows.filter((r) => withinHours(r.lead.fdd_requested_at, 24, now));
  const activeLast24h = rows.filter((r) => withinHours(r.lastActivityAt, 24, now));

  // Priority list: follow-ups first, then everyone else by recency.
  const priority: InvestorRow[] = [...needsFollowUp, ...rows.filter((r) => !r.followUp.needed)].slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Welcome back, {user.first_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsFollowUp.length > 0
            ? `${needsFollowUp.length} client${needsFollowUp.length === 1 ? "" : "s"} need${needsFollowUp.length === 1 ? "s" : ""} follow-up.`
            : "No follow-ups pending."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="New clients (7 days)" value={newLast7d.length} href="/advisor/investors?active=168" />
        <StatCard
          label="Questionnaires completed"
          value={questionnairesCompleted.length}
          href="/advisor/investors?questionnaire=completed"
        />
        <StatCard
          label="Consultations scheduled"
          value={consultationsScheduled.length}
          href="/advisor/investors?consultation=scheduled"
        />
        <StatCard label="FDDs in flight" value={fddInFlight.length} href="/advisor/investors?fdd=sent" />
        <StatCard
          label="Needing follow-up"
          value={needsFollowUp.length}
          href="/advisor/investors?followUp=1"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Today&rsquo;s Calls</CardTitle>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </CardHeader>
        <CardContent>
          {!calendarConfigured ? (
            <p className="text-sm text-muted-foreground">
              Not connected yet. Set <code className="rounded bg-surface px-1 py-0.5 text-xs">GHL_CALENDAR_ID</code>{" "}
              (GoHighLevel → Settings → Calendars) to show today&rsquo;s bookings here.
            </p>
          ) : calendar.error ? (
            <p className="text-sm text-destructive">Couldn&rsquo;t load the calendar: {calendar.error}</p>
          ) : calendar.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls scheduled today.</p>
          ) : (
            <ul className="space-y-2">
              {calendar.events.map((event) => {
                const matched = event.contactEmail
                  ? emailToLead.get(event.contactEmail.toLowerCase())
                  : undefined;
                return (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-control border border-border-soft bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      {matched ? (
                        <Link
                          href={`/advisor/investors/${matched.lead.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {event.title}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.startTime)}</p>
                    </div>
                    <Badge variant={event.status === "cancelled" ? "outline" : "primary"}>
                      {ghlAppointmentStatusLabel(event.status)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                New questionnaires (24h)
              </p>
              {questionnairesLast24h.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {questionnairesLast24h.map((r) => (
                    <li key={r.lead.id} className="text-sm">
                      <Link href={`/advisor/investors/${r.lead.id}`} className="text-primary hover:underline">
                        {r.lead.first_name} {r.lead.last_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                FDD requests (24h)
              </p>
              {fddRequestsLast24h.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {fddRequestsLast24h.map((r) => (
                    <li key={r.lead.id} className="text-sm">
                      <Link href={`/advisor/investors/${r.lead.id}`} className="text-primary hover:underline">
                        {r.lead.first_name} {r.lead.last_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                Active in last 24h
              </p>
              <p className="mt-1 text-sm text-secondary-foreground">
                {activeLast24h.length} client{activeLast24h.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Priority Clients</CardTitle>
          <Link href="/advisor/investors" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <InvestorTable rows={priority} showNextAction emptyMessage="No clients yet." />
        </CardContent>
      </Card>
    </div>
  );
}
