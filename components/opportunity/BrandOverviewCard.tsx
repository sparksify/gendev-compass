import { Card, CardContent } from "@/components/ui/card";

interface BrandOverviewCardProps {
  /** Overview paragraphs, investment-memo tone. */
  paragraphs: string[];
}

/** Business Overview — concise, memo-style description of the brand. */
export function BrandOverviewCard({ paragraphs }: BrandOverviewCardProps) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Business Overview</h2>
        <div className="mt-3.5 max-w-3xl space-y-3">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-[13.5px] leading-[1.65] text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
