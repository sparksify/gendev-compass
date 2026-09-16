import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tracking/settings", () => ({ getEffectiveTrackingSettings: vi.fn() }));
vi.mock("@/lib/tracking/consent", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/tracking/consent")>(),
  readConsentCookie: vi.fn(),
}));

import { getEffectiveTrackingSettings } from "@/lib/tracking/settings";
import { readConsentCookie } from "@/lib/tracking/consent";
import { CloseBotTracking } from "@/components/bridge/CloseBotTracking";

const settings = {
  consentRequired: true,
  marketingTrackingDefault: "denied",
} as Awaited<ReturnType<typeof getEffectiveTrackingSettings>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getEffectiveTrackingSettings).mockResolvedValue(settings);
  vi.mocked(readConsentCookie).mockResolvedValue(null);
});

describe("CloseBot on the acquisition bridge", () => {
  it("loads once on the bridge after marketing consent", async () => {
    vi.mocked(readConsentCookie).mockResolvedValue({
      necessary: true, analytics: true, marketing: true, version: "v1",
    });
    const element = await CloseBotTracking();
    expect(element?.props).toMatchObject({
      id: "closebot-bridge",
      src: "https://api.closebot.com/scripts/cb.js?source=ZpC5XwuqOJVlUXWU",
      strategy: "afterInteractive",
    });
  });

  it("does not load before consent or after marketing is denied", async () => {
    expect(await CloseBotTracking()).toBeNull();
    vi.mocked(readConsentCookie).mockResolvedValue({
      necessary: true, analytics: false, marketing: false, version: "v1",
    });
    expect(await CloseBotTracking()).toBeNull();
  });

  it("fails closed when settings are unavailable", async () => {
    vi.mocked(getEffectiveTrackingSettings).mockRejectedValue(new Error("unavailable"));
    expect(await CloseBotTracking()).toBeNull();
  });
});
