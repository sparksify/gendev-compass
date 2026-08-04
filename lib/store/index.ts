import { isProduction, isSupabaseConfigured } from "@/lib/config/env";
import type { PortalStore } from "./types";
import { createSupabaseStore } from "./supabaseStore";
import { createDevStore } from "./devStore";

let store: PortalStore | null = null;

/**
 * Returns the active data store: Supabase when configured, otherwise a
 * file-backed development store. Production requires Supabase.
 */
export function getStore(): PortalStore {
  if (store) return store;

  if (isSupabaseConfigured()) {
    store = createSupabaseStore();
  } else if (!isProduction()) {
    console.warn(
      "[store] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using the local development store (.dev-data/store.json).",
    );
    store = createDevStore();
  } else {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production.",
    );
  }
  return store;
}
