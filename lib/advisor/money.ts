/**
 * Compact money for dense tables and stat rows: the questionnaire's own
 * range labels ("$250,000 – $499,999") are too wide for a grid column, so
 * they collapse to the form the handoff shows — "$250k–$500k". Only the
 * presentation changes; the stored range value is untouched.
 */

function compact(amount: number): string {
  if (amount >= 950_000) {
    const millions = Math.round(amount / 100_000) / 10;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount}`;
}

export function compactMoney(label: string): string {
  if (!label || label === "—") return label;
  return label
    .replace(/\$\s?([\d,]+)/g, (_match, digits: string) =>
      compact(Number(digits.replace(/,/g, ""))),
    )
    .replace(/\s*[–-]\s*/g, "–")
    .replace(/\s+\+/, "+");
}
