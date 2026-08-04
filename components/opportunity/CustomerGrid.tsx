import { Card, CardContent } from "@/components/ui/card";
import { OPPORTUNITY_ICONS } from "@/components/opportunity/icons";
import type { CustomerSegment } from "@/lib/config/opportunity";

/** Primary Customers — responsive grid of served segments with one-liners. */
export function CustomerGrid({ customers }: { customers: CustomerSegment[] }) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Primary Customers</h2>
        <ul className="mt-3.5 grid gap-[9px] sm:grid-cols-2 xl:grid-cols-4">
          {customers.map((segment) => {
            const Icon = OPPORTUNITY_ICONS[segment.icon];
            return (
              <li
                key={segment.key}
                className="rounded-control border border-border px-[13px] py-3"
              >
                <Icon className="size-[17px] text-muted-foreground" strokeWidth={1.7} />
                <p className="mt-2.5 text-[13px] font-medium text-foreground">{segment.name}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {segment.description}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
