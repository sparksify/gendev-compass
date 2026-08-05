/**
 * Structured, PII-free diagnostics for the activation flow (spec: admin/debug
 * view + structured logs). Never pass phone numbers, emails, HighLevel ids,
 * or session/cookie values in `data` — ids and counts only.
 */
export function logActivation(event: string, data: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      scope: "portal-activation",
      event,
      at: new Date().toISOString(),
      ...data,
    }),
  );
}
