import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getZoomTokenEncryptionKey } from "@/lib/config/zoom";

function resolveKey(): Buffer | null {
  const raw = getZoomTokenEncryptionKey();
  if (!raw) return null;
  try {
    const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptZoomToken(plaintext: string): string {
  const key = resolveKey();
  if (!key) throw new Error("ZOOM_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64 key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptZoomToken(stored: string): string {
  const key = resolveKey();
  if (!key) throw new Error("ZOOM_TOKEN_ENCRYPTION_KEY is unavailable");
  const value = Buffer.from(stored, "base64");
  if (value.length < 29) throw new Error("Stored Zoom token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
  decipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
}
