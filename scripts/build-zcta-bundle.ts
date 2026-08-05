/**
 * Offline build of the shipped ZCTA boundary bundle (data/zcta/): downloads
 * every state's Census 2010 ZCTA GeoJSON from the OpenDataDE mirror, runs
 * it through the same parse/simplify pipeline the app uses
 * (lib/territory/polygonImport.ts, parseStatePolygons), and writes one
 * gzipped, upsert-ready file per state plus a manifest.
 *
 * Run at development time (npm run build:zcta) and commit the outputs —
 * ZCTA shapes are static between decennial Censuses, so this is a
 * once-a-decade job, not a runtime one. The app never downloads boundary
 * data in production; it reads these files (lib/territory/zctaBundle.ts).
 */
import { mkdirSync, writeFileSync, statSync } from "fs";
import path from "path";
import { gzipSync } from "zlib";
import {
  parseStatePolygons,
  polygonSourceUrl,
  POLYGON_SOURCE_VERSION,
  SUPPORTED_POLYGON_STATES,
} from "../lib/territory/polygonImport";

const OUT_DIR = path.join(process.cwd(), "data", "zcta");
/** Offline build tolerates slow mirrors; no serverless budget applies here. */
const FETCH_TIMEOUT_MS = 600_000;
const CONCURRENCY = 4;

async function buildState(state: string): Promise<{ state: string; zctas: number; gzBytes: number }> {
  const url = polygonSourceUrl(state);
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${state}: HTTP ${response.status}`);
  const collection = (await response.json()) as { features?: unknown[] };
  const rows = parseStatePolygons(collection as never, state);
  if (rows.length === 0) throw new Error(`${state}: parsed 0 ZCTAs — refusing to write an empty file`);

  const gz = gzipSync(JSON.stringify(rows), { level: 9 });
  const filePath = path.join(OUT_DIR, `${state}.json.gz`);
  writeFileSync(filePath, gz);
  const gzBytes = statSync(filePath).size;
  console.log(`  ${state}: ${rows.length} ZCTAs, ${(gzBytes / 1024 / 1024).toFixed(2)} MB gz`);
  return { state, zctas: rows.length, gzBytes };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const queue = [...SUPPORTED_POLYGON_STATES];
  const results: Array<{ state: string; zctas: number; gzBytes: number }> = [];
  const failures: string[] = [];

  async function worker() {
    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) return;
      try {
        results.push(await buildState(state));
      } catch (error) {
        console.error(`  FAILED ${state}:`, error instanceof Error ? error.message : error);
        failures.push(state);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  results.sort((a, b) => a.state.localeCompare(b.state));
  const manifest = {
    version: POLYGON_SOURCE_VERSION,
    builtAt: new Date().toISOString(),
    states: results,
  };
  writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  const totalZctas = results.reduce((sum, r) => sum + r.zctas, 0);
  const totalMb = results.reduce((sum, r) => sum + r.gzBytes, 0) / 1024 / 1024;
  console.log(`\nBundle: ${results.length} states, ${totalZctas} ZCTAs, ${totalMb.toFixed(1)} MB gz total`);
  if (failures.length > 0) {
    console.error(`FAILED states (re-run to retry): ${failures.join(", ")}`);
    process.exit(1);
  }
}

void main();
