import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OpportunityDocument } from "@/lib/config/opportunity";

/** One opportunity document: format, contents, and a view action. */
function DocumentTile({ document }: { document: OpportunityDocument }) {
  return (
    <Card className="transition-shadow hover:shadow-[0_4px_12px_rgb(16_24_40/0.08)]">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-[19px] shrink-0 text-primary" strokeWidth={1.5} />
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold text-foreground">{document.title}</h3>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {document.format}
              {document.fileSize ? ` · ${document.fileSize}` : ""}
            </p>
          </div>
        </div>

        <ul className="mt-3.5 space-y-1 border-t border-border-soft pt-3">
          {document.contents.map((line) => (
            <li key={line} className="text-[12.5px] text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          {document.href ? (
            <Button asChild variant="secondary" className="w-full">
              <a href={document.href} target="_blank" rel="noreferrer">
                {document.ctaLabel}
              </a>
            </Button>
          ) : (
            <div>
              <Button variant="secondary" className="w-full" disabled>
                {document.ctaLabel}
              </Button>
              <p className="mt-1.5 text-center text-[11px] text-faint-foreground">
                Available soon
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Opportunity Documents section. */
export function DocumentLibrary({ documents }: { documents: OpportunityDocument[] }) {
  return (
    <section id="documents" aria-label="Opportunity documents">
      <h2 className="text-[15.5px] font-bold text-foreground">Opportunity Documents</h2>
      <div className="mt-3.5 grid gap-[18px] sm:grid-cols-2">
        {documents.map((document) => (
          <DocumentTile key={document.key} document={document} />
        ))}
      </div>
    </section>
  );
}
