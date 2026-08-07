import { createHash } from "crypto";

/**
 * Meta CAPI user-data normalization + hashing (spec §10). Meta requires
 * lowercase, trimmed, SHA-256-hashed PII for every applicable matching
 * field: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 * (verify against current docs before relying on this in production —
 * Meta's exact normalization rules can change).
 */

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return sha256Hex(email.trim().toLowerCase());
}

/** Digits only, kept as a leading '+' country code convention is not required by Meta — just digits. */
export function hashPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return sha256Hex(digits);
}

export function hashName(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return normalized ? sha256Hex(normalized) : null;
}

export function hashLower(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  return normalized ? sha256Hex(normalized) : null;
}

/** External ID (our internal lead ID) — hashed per Meta's recommendation, though it's not raw PII. */
export function hashExternalId(id: string | null | undefined): string | null {
  if (!id) return null;
  return sha256Hex(id.trim());
}
