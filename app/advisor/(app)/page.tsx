import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { InvestorTable } from "@/components/advisor/InvestorTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/advisor/format";

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

function isToday(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
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

  const newLast7d = rows.filter((r) => withinHours(r.lead.created_at, 7 * 24, now));
  const questionnairesCompleted = rows.filter((r) => r.lead.questionnaire_completed_at);
  const consultationsScheduled = rows.filter(
    (r) => r.activeAppointment || (r.lead.booked_at && !r.appointments.some((a) => a.status === "COMPLETED")),
  );
  const fddInFlight = rows.filter(
    (r) => r.fdd && r.fdd.status !== "NOT_REQUESTED" && r.fdd.status !== "ACKNOWLEDGED",
  );
  const needsFollowUp = rows.filter((r) => r.followUp.needed);

  const consultationsToday = rows.filter((r) =>
    isToday(r.activeAppointment?.scheduled_start ?? r.lead.appointment_start_at, now),
  );
  const questionnairesLast24h = rows.filter((r) =>
    withinHours(r.lead.questionnaire_completed_at, 24, now),
  );
  const fddRequestsLast24h = rows.filter((r) => withinHours(r.fdd?.requested_at, 24, now));
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
            ? `${needsFollowUp.length} investor${needsFollowUp.length === 1 ? "" : "s"} need${needsFollowUp.length === 1 ? "s" : ""} follow-up.`
            : "No follow-ups pending."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="New investors (7 days)" value={newLast7d.length} href="/advisor/investors?active=168" />
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
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                Consultations today
              </p>
              {consultationsToday.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None scheduled</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {consultationsToday.map((r) => (
                    <li key={r.lead.id} className="text-sm">
                      <Link href={`/advisor/investors/${r.lead.id}`} className="text-primary hover:underline">
                        {r.lead.first_name} {r.lead.last_name}
                      </Link>
                      <span className="ml-1 text-muted-foreground">
                        {formatDateTime(
                          r.activeAppointment?.scheduled_start ?? r.lead.appointment_start_at,
                          r.activeAppointment?.time_zone,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                {activeLast24h.length} investor{activeLast24h.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Priority Investors</CardTitle>
          <Link href="/advisor/investors" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <InvestorTable rows={priority} showNextAction emptyMessage="No investors yet." />
        </CardContent>
      </Card>
    </div>
  );
}
