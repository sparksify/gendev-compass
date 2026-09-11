/**
 * Four facts, no paragraphs. Deliberately free of revenue, margin, or
 * earnings language — anything of that kind belongs only in a compliant,
 * substantiated financial performance representation.
 */
const POINTS = [
  { title: "B2B Business Model", line: "Built around employer relationships." },
  { title: "Mobile-First Operations", line: "Serve businesses where they need you." },
  { title: "13+ Years Operating", line: "An established model with operating history." },
  { title: "Local Market Focus", line: "Build relationships within your territory." },
] as const;

export function ProofStrip() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {POINTS.map((point) => (
        <li
          key={point.title}
          className="rounded-card border border-border bg-card px-5 py-[18px] shadow-card"
        >
          <span aria-hidden className="block h-[3px] w-7 rounded-full bg-accent-gold" />
          <p className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-sidebar">
            {point.title}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">{point.line}</p>
        </li>
      ))}
    </ul>
  );
}
