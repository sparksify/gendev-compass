import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FranchiseBrandRecord } from "@/types/territory";

interface BrandSelectorProps {
  brands: FranchiseBrandRecord[];
  activeBrandSlug?: string;
  basePath: string;
}

/**
 * Simple brand switcher for admin pages. Renders as plain text when there's
 * only one brand (today's reality) so the UI doesn't imply a choice that
 * doesn't exist yet — the moment a second brand is added, this becomes a
 * real selector automatically.
 */
export function BrandSelector({ brands, activeBrandSlug, basePath }: BrandSelectorProps) {
  if (brands.length <= 1) {
    return (
      <p className="text-[14.5px] text-muted-foreground">
        Brand: <span className="font-medium text-foreground">{brands[0]?.name ?? "—"}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {brands.map((b) => (
        <Link
          key={b.id}
          href={`${basePath}?brand=${b.slug}`}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[13.5px] leading-[1.45] font-medium transition-colors",
            b.slug === activeBrandSlug
              ? "border-primary-soft-border bg-primary-soft text-primary"
              : "border-border text-muted-foreground hover:bg-surface",
          )}
        >
          {b.name}
        </Link>
      ))}
    </div>
  );
}
