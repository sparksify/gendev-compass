import { Card, CardContent } from "@/components/ui/card";
import { OPPORTUNITY_ICONS } from "@/components/opportunity/icons";
import type { OpportunityFeature } from "@/lib/config/opportunity";

/** One "Why This Business" card: icon, title, two-sentence description. */
export function FeatureCard({ feature }: { feature: OpportunityFeature }) {
  const Icon = OPPORTUNITY_ICONS[feature.icon];
  return (
    <Card>
      <CardContent>
        <span className="flex size-9 items-center justify-center rounded-control border border-primary-soft-border bg-primary-soft text-primary">
          <Icon className="size-[17px]" strokeWidth={1.7} />
        </span>
        <h3 className="mt-3.5 text-[13.5px] font-bold text-foreground">{feature.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          {feature.description}
        </p>
      </CardContent>
    </Card>
  );
}

/** The four-card "Why This Business" grid. */
export function FeatureGrid({ features }: { features: OpportunityFeature[] }) {
  return (
    <section aria-label="Why this business">
      <div className="grid gap-[18px] sm:grid-cols-2">
        {features.map((feature) => (
          <FeatureCard key={feature.key} feature={feature} />
        ))}
      </div>
    </section>
  );
}
