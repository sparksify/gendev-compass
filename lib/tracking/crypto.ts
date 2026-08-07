import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getTrackingEncryptionKey } from "@/lib/config/tracking";

/**
 * At-rest encryption for the Meta Conversions API access token (spec §3-C:
 * "never expose the access token... encrypt sensitive credentials at rest
 * where practical"). AES-256-GCM with a server-only key from
 * TRACKING_ENCRYPTION_KEY. Ciphertext format: base64(iv[12] || authTag[16] || data).
 *
 * Without TRACKING_ENCRYPTION_KEY configured, encryption is unavailable and
 * the admin UI refuses to save a token directly — deployments without a key
 * fall back to the META_CAPI_ACCESS_TOKEN env var (lib/config/tracking.ts),
 * which never touches the database at all.
 */

function resolveKey(): Buffer | null {
  const raw = getTrackingEncryptionKey();
  if (!raw) return null;
  try {
    // Accept 32-byte hex (64 chars) or base64.
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function trackingEncryptionAvailable(): boolean {
  return resolveKey() !== null;
}

export function encryptSecret(plaintext: string): string {
  const key = resolveKey();
  if (!key) {
    throw new Error(
      "TRACKING_ENCRYPTION_KEY is not configured — cannot encrypt a secret at rest. Set a 32-byte key (hex or base64) or use the META_CAPI_ACCESS_TOKEN env var fallback instead.",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(stored: string): string | null {
  const key = resolveKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(stored, "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("[tracking] failed to decrypt Meta CAPI token — treating as unconfigured:", error);
    return null;
  }
}
