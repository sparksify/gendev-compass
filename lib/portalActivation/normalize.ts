/** Digits only, e.g. "+1 (214) 555-1212" → "12145551212". */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function phoneLastFour(phone: string | null | undefined): string | null {
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 4) return null;
  return digits.slice(-4);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Exactly four numeric digits — the only shape accepted for the fallback field. */
export function isValidLastFour(value: string): boolean {
  return /^\d{4}$/.test(value);
}
