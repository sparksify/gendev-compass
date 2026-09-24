import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getZoomClientId,
  getZoomClientSecret,
  getZoomRedirectUri,
} from "@/lib/config/zoom";
import { decryptZoomToken, encryptZoomToken } from "@/lib/zoom/crypto";

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

interface StoredZoomCredential {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_token_expires_at: string;
}

function basicAuthorization(): string {
  const clientId = getZoomClientId();
  const clientSecret = getZoomClientSecret();
  if (!clientId || !clientSecret) throw new Error("Zoom OAuth credentials are not configured");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestToken(params: URLSearchParams): Promise<ZoomTokenResponse> {
  const response = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: basicAuthorization() },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as (ZoomTokenResponse & { reason?: string }) | null;
  if (!response.ok || !body?.access_token || !body.refresh_token) {
    console.error("[zoom] token exchange failed", response.status, body?.reason ?? "unknown response");
    throw new Error("Zoom authorization could not be completed");
  }
  return body;
}

async function saveTokens(tokens: ZoomTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in - 60) * 1000).toISOString();
  const { error } = await getSupabaseAdmin().from("zoom_oauth_credentials").upsert(
    {
      id: "primary",
      access_token_ciphertext: encryptZoomToken(tokens.access_token),
      refresh_token_ciphertext: encryptZoomToken(tokens.refresh_token),
      access_token_expires_at: expiresAt,
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Zoom credentials could not be saved: ${error.message}`);
}

export async function exchangeZoomAuthorizationCode(code: string): Promise<void> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getZoomRedirectUri(),
    }),
  );
  await saveTokens(tokens);
}

export async function getZoomAccessToken(): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("zoom_oauth_credentials")
    .select("access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at")
    .eq("id", "primary")
    .maybeSingle<StoredZoomCredential>();
  if (error) throw new Error(`Zoom connection could not be loaded: ${error.message}`);
  if (!data) throw new Error("Zoom is not connected");

  if (new Date(data.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return decryptZoomToken(data.access_token_ciphertext);
  }

  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptZoomToken(data.refresh_token_ciphertext),
    }),
  );
  await saveTokens(tokens);
  return tokens.access_token;
}
