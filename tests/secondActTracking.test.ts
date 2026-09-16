import { beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";

vi.mock("@/lib/tracking/settings", () => ({ getEffectiveTrackingSettings: vi.fn() }));
vi.mock("@/lib/tracking/consent", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/tracking/consent")>(),
  readConsentCookie: vi.fn(),
}));

import { getEffectiveTrackingSettings } from "@/lib/tracking/settings";
import { readConsentCookie } from "@/lib/tracking/consent";
import { GET } from "@/app/api/tracking/second-act/route";

const settings = {
  metaEnabled: true,
  metaBrowserMode: "direct",
  metaPixelId: "1331750968775891",
  consentRequired: true,
  marketingTrackingDefault: "granted",
} as Awaited<ReturnType<typeof getEffectiveTrackingSettings>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getEffectiveTrackingSettings).mockResolvedValue(settings);
  vi.mocked(readConsentCookie).mockResolvedValue(null);
});

describe("static advertorial tracking", () => {
  it("loads Meta and queues PageView and ViewContent once for the configured pixel", async () => {
    const response = await GET();
    const script = await response.text();
    const inserted: { src: string }[] = [];
    const tags: { src?: string; async?: boolean; dataset: Record<string, string> }[] = [];
    const sandbox: Record<string, unknown> = {
      document: {
        createElement: () => ({ dataset: {} }),
        querySelector: () => tags.find((tag) => "gdcClosebot" in tag.dataset) ?? null,
        head: { appendChild: (tag: { src: string; dataset: Record<string, string> }) => tags.push(tag) },
        getElementsByTagName: () => [{ parentNode: { insertBefore: (node: { src: string }) => inserted.push(node) } }],
      },
    };
    sandbox.window = sandbox;
    runInNewContext(script, sandbox);
    runInNewContext(script, sandbox);
    const fbq = sandbox.fbq as { queue: IArguments[] };
    expect(fbq.queue.map((args) => Array.from(args))).toEqual([
      ["init", settings.metaPixelId],
      ["track", "PageView"],
      ["track", "ViewContent", { content_name: "The Second Act Report - CMDT advertorial", content_category: "advertorial" }],
    ]);
    expect(inserted.map((node) => node.src)).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
    expect(tags.map((tag) => tag.src)).toEqual(["https://api.closebot.com/scripts/cb.js?source=ZpC5XwuqOJVlUXWU"]);
    expect(tags[0].async).toBe(true);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("does not load Meta or CloseBot when marketing consent is denied", async () => {
    vi.mocked(readConsentCookie).mockResolvedValue({ necessary: true, analytics: false, marketing: false, version: "v1" });
    const script = await (await GET()).text();
    expect(script).not.toContain("fbq");
    expect(script).not.toContain("closebot.com");
  });

  it("loads CloseBot when Meta is disabled but marketing is allowed", async () => {
    vi.mocked(getEffectiveTrackingSettings).mockResolvedValue({ ...settings, metaEnabled: false });
    const script = await (await GET()).text();
    expect(script).toContain("https://api.closebot.com/scripts/cb.js?source=ZpC5XwuqOJVlUXWU");
    expect(script).not.toContain("fbq");
  });

  it.each([
    { marketingTrackingDefault: "denied" },
    { metaEnabled: false },
    { metaBrowserMode: "gtm" },
    { metaPixelId: null },
    { metaPixelId: "invalid-pixel" },
  ])("respects disabled or unavailable tracking: %j", async (override) => {
    vi.mocked(getEffectiveTrackingSettings).mockResolvedValue({ ...settings, ...override } as typeof settings);
    expect(await (await GET()).text()).not.toContain("fbq");
  });

  it("fails closed if tracking settings cannot be read", async () => {
    vi.mocked(getEffectiveTrackingSettings).mockRejectedValue(new Error("unavailable"));
    const script = await (await GET()).text();
    expect(script).not.toContain("fbq");
    expect(script).not.toContain("closebot.com");
  });
});
