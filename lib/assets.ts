import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured, isProduction } from "@/lib/config/env";
import {
  CMDT_PROFILE,
  type OpportunityProfile,
} from "@/lib/config/opportunity";

/**
 * Admin-uploaded site assets (logos, documents). Each asset occupies a
 * stable slot key. Files live in the public `portal-assets` Supabase
 * bucket (with a file-backed fallback for local development); the
 * `site_assets` table maps slot keys to the current file.
 */

export interface SiteAsset {
  key: string;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  updated_at: string;
}

export interface AssetSlot {
  key: string;
  label: string;
  description: string;
  /** Allowed MIME types. */
  accept: string[];
  maxBytes: number;
}

const IMAGE_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
const PDF_TYPES = ["application/pdf"];
const MB = 1024 * 1024;

export const ASSET_SLOTS: AssetSlot[] = [
  {
    key: "site-logo",
    label: "Site Logo",
    description: "The GenDev Compass mark shown in the header and sidebar.",
    accept: IMAGE_TYPES,
    maxBytes: 2 * MB,
  },
  {
    key: "brand-logo",
    label: "Brand Logo (CMDT)",
    description: "Shown in the Investment Snapshot card and the Investor Overview header.",
    accept: IMAGE_TYPES,
    maxBytes: 2 * MB,
  },
  {
    key: "advisor-photo",
    label: "Advisor Photo",
    description: "Shown on the advisor card in the right sidebar.",
    accept: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 4 * MB,
  },
  {
    key: "brand-presentation",
    label: "CMDT Franchise Opportunity Presentation",
    description: "PDF served by the presentation document card and the header download button.",
    accept: PDF_TYPES,
    maxBytes: 150 * MB,
  },
  {
    key: "brand-one-sheet",
    label: "CMDT Opportunity One Sheet",
    description: "PDF served by the one-sheet document card.",
    accept: PDF_TYPES,
    maxBytes: 50 * MB,
  },
];

export function getAssetSlot(key: string): AssetSlot | undefined {
  return ASSET_SLOTS.find((slot) => slot.key === key);
}

const BUCKET = "portal-assets";
const DEV_DIR = path.join(process.cwd(), ".dev-data", "uploads");
const DEV_INDEX = path.join(process.cwd(), ".dev-data", "assets.json");

async function readDevIndex(): Promise<Record<string, SiteAsset>> {
  try {
    return JSON.parse(await fs.readFile(DEV_INDEX, "utf8")) as Record<string, SiteAsset>;
  } catch {
    return {};
  }
}

/** Current asset per slot key. Deduped per request via React cache. */
export const getSiteAssets = cache(async (): Promise<Record<string, SiteAsset>> => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabaseAdmin().from("site_assets").select("*");
      if (error) throw error;
      return Object.fromEntries((data as SiteAsset[]).map((asset) => [asset.key, asset]));
    }
    if (!isProduction()) {
      return await readDevIndex();
    }
  } catch (error) {
    console.error("[assets] lookup failed:", error);
  }
  return {};
});

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "file";
}

export interface SaveAssetInput {
  key: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export async function saveSiteAsset(input: SaveAssetInput): Promise<SiteAsset> {
  const filename = sanitizeFilename(input.filename);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    // Versioned path so CDN caches never serve a stale file after replacement.
    const storagePath = `${input.key}/${Date.now()}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.buffer, { contentType: input.contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const asset: SiteAsset = {
      key: input.key,
      url: publicUrl.publicUrl,
      filename,
      content_type: input.contentType,
      size_bytes: input.buffer.byteLength,
      updated_at: now,
    };
    const { error: upsertError } = await supabase
      .from("site_assets")
      .upsert(asset, { onConflict: "key" });
    if (upsertError) throw upsertError;
    return asset;
  }

  if (isProduction()) {
    throw new Error("Supabase must be configured to store uploads in production");
  }

  // Local development fallback: file on disk, served by /api/assets/[key].
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, input.key), input.buffer);
  const asset: SiteAsset = {
    key: input.key,
    url: `/api/assets/${input.key}`,
    filename,
    content_type: input.contentType,
    size_bytes: input.buffer.byteLength,
    updated_at: now,
  };
  const index = await readDevIndex();
  index[input.key] = asset;
  await fs.mkdir(path.dirname(DEV_INDEX), { recursive: true });
  await fs.writeFile(DEV_INDEX, JSON.stringify(index, null, 2));
  return asset;
}

/**
 * Create a short-lived signed URL the browser can PUT the file to directly.
 * Bypasses the serverless request-size ceiling for large documents.
 */
export async function createSignedAssetUpload(
  key: string,
  filename: string,
): Promise<{ signedUrl: string; path: string }> {
  const supabase = getSupabaseAdmin();
  const path = `${key}/${Date.now()}-${sanitizeFilename(filename)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create signed upload URL");
  return { signedUrl: data.signedUrl, path: data.path };
}

/**
 * Record a browser-completed signed upload after verifying the object
 * actually landed in storage (size read from storage metadata).
 */
export async function commitSignedAsset(input: {
  key: string;
  path: string;
  filename: string;
  contentType: string;
}): Promise<SiteAsset> {
  const supabase = getSupabaseAdmin();
  const objectName = input.path.slice(input.key.length + 1);
  const { data: entries, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(input.key, { limit: 100, search: objectName });
  if (listError) throw listError;
  const object = (entries ?? []).find((entry) => entry.name === objectName);
  if (!object) throw new Error("Uploaded file not found in storage");

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(input.path);
  const metadata = object.metadata as { size?: number; mimetype?: string } | null;
  const asset: SiteAsset = {
    key: input.key,
    url: publicUrl.publicUrl,
    filename: sanitizeFilename(input.filename),
    content_type: metadata?.mimetype ?? input.contentType,
    size_bytes: metadata?.size ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertError } = await supabase
    .from("site_assets")
    .upsert(asset, { onConflict: "key" });
  if (upsertError) throw upsertError;
  return asset;
}

/** Dev-only: raw file bytes for /api/assets/[key]. */
export async function readDevAssetFile(
  key: string,
): Promise<{ buffer: Buffer; asset: SiteAsset } | null> {
  const index = await readDevIndex();
  const asset = index[key];
  if (!asset) return null;
  try {
    const buffer = await fs.readFile(path.join(DEV_DIR, key));
    return { buffer, asset };
  } catch {
    return null;
  }
}

export function formatFileSize(bytes: number | null | undefined): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** The site logo URL: admin upload wins, bundled mark otherwise. */
export async function getSiteLogoUrl(): Promise<string> {
  const assets = await getSiteAssets();
  return assets["site-logo"]?.url ?? "/logo.svg";
}

/** The advisor photo URL: admin upload wins, bundled photo otherwise. */
export async function getAdvisorPhotoUrl(): Promise<string | null> {
  const assets = await getSiteAssets();
  return assets["advisor-photo"]?.url ?? null;
}

/**
 * The opportunity profile with admin-uploaded assets merged in: brand
 * logo, presentation, and one sheet override the bundled defaults.
 */
export async function resolveOpportunityProfile(): Promise<OpportunityProfile> {
  const assets = await getSiteAssets();
  const presentation = assets["brand-presentation"];
  const oneSheet = assets["brand-one-sheet"];

  // Admin uploads win over bundled/env defaults.
  return {
    ...CMDT_PROFILE,
    logoPath: assets["brand-logo"]?.url ?? CMDT_PROFILE.logoPath,
    overviewDownloadUrl: presentation?.url ?? CMDT_PROFILE.overviewDownloadUrl,
    documents: CMDT_PROFILE.documents.map((document) => {
      const asset =
        document.key === "presentation"
          ? presentation
          : document.key === "one-sheet"
            ? oneSheet
            : undefined;
      if (!asset) return document;
      return {
        ...document,
        href: asset.url,
        fileSize: formatFileSize(asset.size_bytes) ?? document.fileSize,
      };
    }),
  };
}
