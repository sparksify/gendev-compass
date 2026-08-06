import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured, isProduction } from "@/lib/config/env";

/**
 * Admin-managed, growable resource library shown on the portal's
 * standalone Resources page. Unlike `lib/assets.ts` (fixed named slots —
 * logo, presentation, one-sheet), a resource is a free-form row an admin
 * can add, rename, or remove at any time. Files live in the same public
 * `portal-assets` Supabase bucket under a `resources/` prefix, with the
 * same file-backed fallback for local development.
 */

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const BUCKET = "portal-assets";
const PREFIX = "resources";
const DEV_DIR = path.join(process.cwd(), ".dev-data", "uploads", "resources");
const DEV_INDEX = path.join(process.cwd(), ".dev-data", "resources.json");

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "file";
}

async function readDevIndex(): Promise<Resource[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_INDEX, "utf8")) as Resource[];
  } catch {
    return [];
  }
}

async function writeDevIndex(resources: Resource[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_INDEX), { recursive: true });
  await fs.writeFile(DEV_INDEX, JSON.stringify(resources, null, 2));
}

/** All resources, most recently added first (within sort_order). */
export async function listResources(): Promise<Resource[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabaseAdmin()
        .from("resources")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Resource[];
    }
    if (!isProduction()) {
      const resources = await readDevIndex();
      return [...resources].sort(
        (a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at),
      );
    }
  } catch (error) {
    console.error("[resources] list failed:", error);
  }
  return [];
}

export interface CreateResourceInput {
  title: string;
  description: string | null;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const id = randomUUID();
  const filename = sanitizeFilename(input.filename);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const storagePath = `${PREFIX}/${id}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.buffer, { contentType: input.contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const resource: Omit<Resource, "sort_order"> & { sort_order?: number } = {
      id,
      title: input.title,
      description: input.description,
      url: publicUrl.publicUrl,
      filename,
      content_type: input.contentType,
      size_bytes: input.buffer.byteLength,
      created_at: now,
      updated_at: now,
    };
    const { data, error: insertError } = await supabase
      .from("resources")
      .insert(resource)
      .select("*")
      .single();
    if (insertError) throw insertError;
    return data as Resource;
  }

  if (isProduction()) {
    throw new Error("Supabase must be configured to store uploads in production");
  }

  // Local development fallback: file on disk, served by /api/resources/file/[id].
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, id), input.buffer);
  const resource: Resource = {
    id,
    title: input.title,
    description: input.description,
    url: `/api/resources/file/${id}`,
    filename,
    content_type: input.contentType,
    size_bytes: input.buffer.byteLength,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };
  const index = await readDevIndex();
  index.push(resource);
  await writeDevIndex(index);
  return resource;
}

export interface ResourcePatch {
  title?: string;
  description?: string | null;
}

export async function updateResource(id: string, patch: ResourcePatch): Promise<Resource | null> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .from("resources")
      .update({ ...patch, updated_at: now })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as Resource | null) ?? null;
  }

  const index = await readDevIndex();
  const existing = index.find((resource) => resource.id === id);
  if (!existing) return null;
  Object.assign(existing, patch, { updated_at: now });
  await writeDevIndex(index);
  return existing;
}

export async function deleteResource(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("resources")
      .select("filename")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) throw error;
    if (existing?.filename) {
      // Best effort — a missed cleanup here just leaves an orphaned file.
      await supabase.storage.from(BUCKET).remove([`${PREFIX}/${id}-${existing.filename}`]);
    }
    return true;
  }

  const index = await readDevIndex();
  const nextIndex = index.filter((resource) => resource.id !== id);
  if (nextIndex.length === index.length) return false;
  await writeDevIndex(nextIndex);
  await fs.rm(path.join(DEV_DIR, id), { force: true });
  return true;
}

/** Dev-only: raw file bytes for /api/resources/file/[id]. */
export async function readDevResourceFile(
  id: string,
): Promise<{ buffer: Buffer; resource: Resource } | null> {
  const index = await readDevIndex();
  const resource = index.find((entry) => entry.id === id);
  if (!resource) return null;
  try {
    const buffer = await fs.readFile(path.join(DEV_DIR, id));
    return { buffer, resource };
  } catch {
    return null;
  }
}
