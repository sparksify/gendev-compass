import { existsSync, readFileSync } from "fs";
import path from "path";
import { gunzipSync } from "zlib";
import type { UpsertZipGeographyInput } from "@/types/territory";

/**
 * The shipped ZCTA boundary bundle: all 50 states + DC, pre-downloaded and
 * pre-simplified by scripts/build-zcta-bundle.ts and committed to the repo
 * (data/zcta/*.json.gz + manifest.json). ZCTA shapes are static between
 * decennial Censuses, so shipping them inside the app removes every
 * runtime download: loading the whole country is just gunzip + parse +
 * batched upserts. The routes that read this data include it in their
 * serverless bundle via `outputFileTracingIncludes` (next.config.ts).
 */

const BUNDLE_DIR = path.join(process.cwd(), "data", "zcta");

export interface ZctaBundleManifest {
  version: string;
  builtAt: string;
  states: Array<{ state: string; zctas: number; gzBytes: number }>;
}

/** The bundle manifest, or null when no bundle is shipped (e.g. fresh clone before the build script runs). */
export function readZctaBundleManifest(): ZctaBundleManifest | null {
  const manifestPath = path.join(BUNDLE_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ZctaBundleManifest;
}

/** USPS codes of every state present in the shipped bundle. */
export function listBundledStates(): string[] {
  return readZctaBundleManifest()?.states.map((s) => s.state) ?? [];
}

/**
 * Loads one state's upsert-ready boundary rows from the shipped bundle,
 * or null when that state isn't bundled (callers fall back to download).
 */
export function loadBundledStateRows(stateCode: string): UpsertZipGeographyInput[] | null {
  const filePath = path.join(BUNDLE_DIR, `${stateCode}.json.gz`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(gunzipSync(readFileSync(filePath)).toString("utf8")) as UpsertZipGeographyInput[];
}
