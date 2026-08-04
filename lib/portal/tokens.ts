import { randomBytes, createHash } from "crypto";

/**
 * Generates a long, random, URL-safe portal token (192 bits of entropy).
 * Never derived from lead data and never sequential.
 */
export function generatePortalToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Hash used when a token-derived identifier must leave our systems
 * (e.g. analytics distinct IDs). Never send the raw token to third parties.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}
