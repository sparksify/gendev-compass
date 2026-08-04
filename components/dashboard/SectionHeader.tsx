interface SectionHeaderProps {
  number?: number;
  title: string;
  description?: string;
}

/** Numbered section heading used for the dashboard's content blocks (comp). */
export function SectionHeader({ number, title, description }: SectionHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-[11px]">
        {number !== undefined && (
          <span
            aria-hidden
            className="flex size-[21px] shrink-0 items-center justify-center rounded-[5px] border border-border-strong text-[11.5px] font-bold text-[#475467]"
          >
            {number}
          </span>
        )}
        <h2 className="text-[15.5px] font-bold text-foreground">{title}</h2>
      </div>
      {description && (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
