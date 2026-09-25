import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptZoomSecret, encryptZoomSecret } from "@/lib/zoom/crypto";

export interface ZoomConnection {
  id: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string;
  accessTokenExpiresAt: string;
  zoomUserId: string | null;
  scopes: string[];
}

export interface ZoomRegistrationRecord {
  id?: string;
  lead_id: string | null;
  meeting_id: string;
  email_normalized: string;
  email: string;
  first_name: string;
  last_name: string;
  registrant_id?: string | null;
  join_url?: string | null;
  status: "registered" | "already_registered" | "failed";
  registered_at?: string | null;
  last_error?: string | null;
}

export async function getZoomConnection(): Promise<ZoomConnection | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("zoom_connections")
    .select("id,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,zoom_user_id,scopes")
    .eq("connection_key", "default")
    .maybeSingle();
  if (error) throw new Error(`Failed to load Zoom connection: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    accessTokenCiphertext: data.access_token_ciphertext,
    refreshTokenCiphertext: data.refresh_token_ciphertext,
    accessTokenExpiresAt: data.access_token_expires_at,
    zoomUserId: data.zoom_user_id,
    scopes: data.scopes ?? [],
  };
}

export async function saveZoomTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  zoomUserId?: string | null;
  scopes?: string[];
}): Promise<void> {
  const db = getSupabaseAdmin();
  const existing = await getZoomConnection();
  const row = {
    connection_key: "default",
    access_token_ciphertext: encryptZoomSecret(input.accessToken),
    refresh_token_ciphertext: encryptZoomSecret(input.refreshToken),
    access_token_expires_at: new Date(Date.now() + Math.max(0, input.expiresIn - 60) * 1000).toISOString(),
    zoom_user_id: input.zoomUserId ?? existing?.zoomUserId ?? null,
    scopes: input.scopes ?? existing?.scopes ?? [],
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? db.from("zoom_connections").update(row).eq("id", existing.id)
    : db.from("zoom_connections").insert(row);
  const { error } = await query;
  if (error) throw new Error(`Failed to save Zoom tokens: ${error.message}`);
}

export function decryptConnectionTokens(connection: ZoomConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decryptZoomSecret(connection.accessTokenCiphertext),
    refreshToken: decryptZoomSecret(connection.refreshTokenCiphertext),
  };
}

export async function findZoomRegistration(meetingId: string, email: string): Promise<ZoomRegistrationRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("zoom_registrations")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("email_normalized", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Failed to load Zoom registration: ${error.message}`);
  return data as ZoomRegistrationRecord | null;
}

export async function saveZoomRegistration(input: ZoomRegistrationRecord): Promise<void> {
  const { error } = await getSupabaseAdmin().from("zoom_registrations").upsert(
    { ...input, email_normalized: input.email.trim().toLowerCase(), updated_at: new Date().toISOString() },
    { onConflict: "meeting_id,email_normalized" },
  );
  if (error) throw new Error(`Failed to save Zoom registration: ${error.message}`);
}
