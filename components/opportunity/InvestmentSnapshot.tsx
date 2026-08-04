import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OpportunityProfile } from "@/lib/config/opportunity";

/**
 * Investment Snapshot — right-rail summary of the opportunity's key terms.
 * Styled like the Advisor card: generous whitespace, muted labels,
 * display-size figures.
 */
export function InvestmentSnapshot({
  profile,
}: {
  profile: Pick<
    OpportunityProfile,
    "name" | "websiteUrl" | "websiteLabel" | "logoPath" | "snapshot"
  >;
}) {
  const { snapshot } = profile;
  return (
    <Card>
      <CardContent>
        <div className="border-b border-border-soft pb-4">
          {profile.logoPath && (
            <Image
              src={profile.logoPath}
              alt={`${profile.name} logo`}
              width={920}
              height={393}
              className="h-auto w-full"
            />
          )}
          <p className="mt-4 text-[13.5px] font-medium text-foreground">{profile.name}</p>
          {profile.websiteUrl && (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block text-[12.5px] text-primary hover:text-primary-hover"
            >
              {profile.websiteLabel ?? profile.websiteUrl}
            </a>
          )}
        </div>

        <dl className="mt-1">
          {snapshot.entries.map((entry) => (
            <div
              key={entry.key}
              className="border-b border-border-soft py-3 last:border-b-0"
            >
              <dt className="text-[12.5px] text-muted-foreground">{entry.label}</dt>
              <dd
                className={cn(
                  "mt-1 text-foreground",
                  entry.emphasize
                    ? "text-[19px] font-bold tracking-tight [font-variant-numeric:tabular-nums]"
                    : "text-[13.5px] font-medium",
                )}
              >
                {entry.value}
              </dd>
            </div>
          ))}

          <div className="border-b border-border-soft py-3">
            <dt className="text-[12.5px] text-muted-foreground">Item 19</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
              {snapshot.item19 === "Available" && (
                <BadgeCheck className="size-4 text-success" strokeWidth={1.8} />
              )}
              {snapshot.item19}
            </dd>
          </div>

          <div className="pt-3">
            <dt className="text-[12.5px] text-muted-foreground">Primary Customers</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {snapshot.primaryCustomers.map((customer) => (
                <Badge key={customer} variant="outline">
                  {customer}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
