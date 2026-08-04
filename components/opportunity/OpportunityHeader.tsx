import { ArrowUpRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OpportunityProfile } from "@/lib/config/opportunity";

interface OpportunityHeaderProps {
  profile: Pick<OpportunityProfile, "name" | "subtitle" | "tags" | "websiteUrl" | "overviewDownloadUrl">;
}

/** Page header: brand name, positioning line, tags, and the two actions. */
export function OpportunityHeader({ profile }: OpportunityHeaderProps) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          {profile.name}
        </h1>
        <p className="mt-3 max-w-xl text-[13.5px] leading-[1.65] text-muted-foreground">
          {profile.subtitle}
        </p>
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {profile.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5 xl:pt-2">
        {profile.websiteUrl ? (
          <Button asChild variant="secondary">
            <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
              Visit Brand Website <ArrowUpRight />
            </a>
          </Button>
        ) : (
          <Button variant="secondary" disabled title="Available soon">
            Visit Brand Website <ArrowUpRight />
          </Button>
        )}
        {profile.overviewDownloadUrl ? (
          <Button asChild>
            <a href={profile.overviewDownloadUrl} target="_blank" rel="noreferrer">
              <Download /> Download Opportunity Overview
            </a>
          </Button>
        ) : (
          <Button disabled title="Available soon">
            <Download /> Download Opportunity Overview
          </Button>
        )}
      </div>
    </div>
  );
}
