import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function keyBytes(): Buffer {
  const value = process.env.ZOOM_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error("ZOOM_TOKEN_ENCRYPTION_KEY is not configured");
  const decoded = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("ZOOM_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return decoded;
}

/** AES-256-GCM ciphertext format: base64(iv || authTag || ciphertext). */
export function encryptZoomSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptZoomSecret(stored: string): string {
  const value = Buffer.from(stored, "base64");
  if (value.length < 29) throw new Error("Invalid encrypted Zoom token");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), value.subarray(0, 12));
  decipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
}
