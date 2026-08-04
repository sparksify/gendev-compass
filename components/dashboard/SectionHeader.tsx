interface SectionHeaderProps {
  number?: number;
  title: string;
  description?: string;
}

/** Numbered section heading used for the dashboard's content blocks. */
export function SectionHeader({ number, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      {number !== undefined && (
        <span
          aria-hidden
          className="mt-px flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-xs font-semibold text-muted-foreground"
        >
          {number}
        </span>
      )}
      <div>
        <h2 className="text-base font-semibold leading-6 text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
