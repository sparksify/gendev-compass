import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompactCardIcon } from "./CompactCardIcon";
import { Disclosure } from "./Disclosure";
import { formatDateTime } from "@/lib/advisor/format";
import type { AppointmentRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";
import type { StaffUserRecord } from "@/types/advisor";

export function ConsultationsCard({
  lead,
  appointments,
  staffById,
  portalUrl,
}: {
  lead: LeadRecord;
  appointments: AppointmentRecord[];
  staffById: Map<string, StaffUserRecord>;
  portalUrl: string;
}) {
  const active = appointments.find((a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED");
  const hasAny = appointments.length > 0 || Boolean(lead.booked_at);

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <CompactCardIcon icon={CalendarDays} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Consultations</p>
            {active ? (
              <>
                <Badge variant="primary" className="mt-1">
                  {active.status === "RESCHEDULED" ? "Rescheduled" : "Scheduled"}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(active.scheduled_start, active.time_zone)}
                </p>
              </>
            ) : hasAny ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(lead.appointment_start_at)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Not scheduled</p>
            )}
            {appointments.length > 0 && (
              <Disclosure summary={`All consultations (${appointments.length})`} className="mt-2">
                <ul className="space-y-2">
                  {appointments.map((appointment) => (
                    <li key={appointment.id} className="text-xs">
                      <Badge variant={appointment.status === "COMPLETED" ? "success" : "primary"}>
                        {appointment.status}
                      </Badge>
                      <p className="mt-1 text-muted-foreground">
                        {formatDateTime(appointment.scheduled_start, appointment.time_zone)}
                        {appointment.advisor_id &&
                          ` · ${staffById.get(appointment.advisor_id)?.first_name ?? ""} ${staffById.get(appointment.advisor_id)?.last_name ?? ""}`.trim()}
                      </p>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <a href={`${portalUrl}/schedule`} target="_blank" rel="noreferrer">
            Schedule
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
