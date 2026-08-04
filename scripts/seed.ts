/**
 * Development seed: creates (or resets) the demo lead and prints its portal
 * URL. Works against Supabase when configured, otherwise the local dev store.
 *
 *   npm run seed          # create demo lead (idempotent)
 *   npm run seed:reset    # reset the demo lead's progress
 */
import { config } from "dotenv";
import { promises as fs } from "fs";
import path from "path";

config({ path: ".env.local" });
config({ path: ".env" });

// The demo token is remembered locally so repeated runs target the same lead.
const TOKEN_FILE = path.join(process.cwd(), ".dev-data", "demo-token.txt");

async function readSavedToken(): Promise<string | null> {
  try {
    return (await fs.readFile(TOKEN_FILE, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

async function saveToken(token: string): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, token, "utf8");
}

async function main() {
  // Imported after dotenv so the store sees the environment.
  const { getStore } = await import("../lib/store");
  const { generatePortalToken } = await import("../lib/portal/tokens");

  const store = getStore();
  const reset = process.argv.includes("--reset");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const savedToken = process.env.DEMO_PORTAL_TOKEN ?? (await readSavedToken());
  let lead = savedToken ? await store.getLeadByToken(savedToken) : null;

  if (!lead) {
    lead = await store.createLead({
      portal_token: generatePortalToken(),
      first_name: "John",
      last_name: "Smith",
      email: "john@example.com",
      phone: "+15555555555",
      source: "demo-seed",
      campaign: null,
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: "500k-999k",
      initial_net_worth: "2.5m-4.9m",
      initial_business_owner: true,
    });
    await saveToken(lead.portal_token);
    console.log("Created demo lead:", lead.id);
  } else if (reset) {
    await store.resetLeadProgress(lead.id);
    console.log("Reset progress for demo lead:", lead.id);
  } else {
    console.log("Demo lead already exists:", lead.id);
  }

  console.log("");
  console.log("Demo portal URL:");
  console.log(`  ${appUrl}/p/${lead.portal_token}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
