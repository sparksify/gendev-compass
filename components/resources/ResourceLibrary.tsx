import { FileText, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/assets";
import type { Resource } from "@/lib/resources";

function ResourceTile({ resource }: { resource: Resource }) {
  const size = formatFileSize(resource.size_bytes);
  return (
    <Card className="transition-shadow hover:shadow-[0_4px_12px_rgb(16_24_40/0.08)]">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-[19px] shrink-0 text-primary" strokeWidth={1.5} />
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold text-foreground">{resource.title}</h3>
            {size && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{size}</p>}
          </div>
        </div>

        {resource.description && (
          <p className="mt-3.5 border-t border-border-soft pt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
            {resource.description}
          </p>
        )}

        <div className="mt-auto pt-4">
          <Button asChild variant="secondary" className="w-full">
            <a href={resource.url} target="_blank" rel="noreferrer">
              View Resource
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Admin-managed resource library — an open-ended list, unlike the fixed
 * Opportunity Documents (presentation/one-sheet) on the Opportunity page. */
export function ResourceLibrary({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2.5 py-10 text-center">
          <FolderOpen className="size-6 text-faint-foreground" strokeWidth={1.6} />
          <p className="text-[13.5px] font-medium text-foreground">No resources yet</p>
          <p className="max-w-sm text-[12.5px] text-muted-foreground">
            Your advisor will add helpful guides, documents, and links here as your evaluation
            continues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-[18px] sm:grid-cols-2">
      {resources.map((resource) => (
        <ResourceTile key={resource.id} resource={resource} />
      ))}
    </div>
  );
}
