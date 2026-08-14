import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured, isProduction } from "@/lib/config/env";

/**
 * Stores the original mapping-software PDF a territory's ZIP list and
 * status were sourced from — an audit trail for "why is this ZIP marked
 * reserved/sold", staff-only and never linked from any prospect-facing
 * page. Same public-bucket pattern as lib/assets.ts / lib/resources.ts;
 * only the URL is persisted (on territory_definitions.source_document_url),
 * no separate table needed.
 */

const BUCKET = "portal-assets";
const PREFIX = "territory-reports";
const DEV_DIR = path.join(process.cwd(), ".dev-data", "uploads", "territory-reports");

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "territory-report.pdf";
}

export interface StoredTerritoryReport {
  url: string;
  filename: string;
}

export async function saveTerritoryReportFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<StoredTerritoryReport> {
  const id = randomUUID();
  const safeName = sanitizeFilename(filename);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const storagePath = `${PREFIX}/${id}-${safeName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return { url: data.publicUrl, filename: safeName };
  }

  if (isProduction()) {
    throw new Error("Supabase must be configured to store uploads in production");
  }

  // Local development fallback: file on disk, served by
  // /api/advisor/territories/reports/file/[id].
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, id), buffer);
  return { url: `/api/advisor/territories/reports/file/${id}?name=${encodeURIComponent(safeName)}`, filename: safeName };
}

/** Dev-only: raw file bytes for the local file-serving route. */
export async function readDevTerritoryReportFile(id: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(DEV_DIR, id));
  } catch {
    return null;
  }
}
