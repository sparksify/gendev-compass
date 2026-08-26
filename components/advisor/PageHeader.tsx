import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The 64px page header every advisor screen opens with: title + faint
 * subtitle on the left, actions on the right, and — on the admin sections —
 * a tab row tucked inside the same bordered block.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  tabs,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  /** Replaces the title on detail pages: "Clients / David Kim". */
  breadcrumb?: { href: string; label: string; current: string };
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card px-5 lg:px-9">
      <div
        className={cn(
          "flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5",
          tabs && "min-h-0 pb-2 pt-3.5",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1">
          {breadcrumb ? (
            <p className="flex items-center gap-2 text-[14px] text-faint-foreground">
              <Link href={breadcrumb.href} className="hover:text-foreground">
                {breadcrumb.label}
              </Link>
              <span aria-hidden>/</span>
              <span className="font-bold text-foreground">{breadcrumb.current}</span>
            </p>
          ) : (
            <h1 className="text-[19px] font-extrabold tracking-[-0.025em] text-foreground">
              {title}
            </h1>
          )}
          {subtitle && <p className="text-[13.5px] leading-[1.45] text-faint-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}

/** Page body: the content column's padding, shared by every screen. */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={cn("flex-1 px-5 py-6 lg:px-9 lg:py-7", className)}>{children}</main>;
}

/**
 * Section overline: a 9.5px uppercase label, a hairline that fills the rest
 * of the row, and optional right-aligned meta.
 */
export function SectionRule({
  label,
  meta,
  className,
}: {
  label: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
        {label}
      </p>
      <span aria-hidden className="h-px flex-1 bg-border" />
      {meta !== undefined && meta !== null && (
        <span className="shrink-0 text-[12.5px] text-faint-foreground">{meta}</span>
      )}
    </div>
  );
}
