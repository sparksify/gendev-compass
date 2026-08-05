import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPortalUrlSyncConfigured, syncPortalUrlToHighLevel } from "./ghlSync";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GHL_API_TOKEN = "test-token";
  process.env.GHL_PORTAL_URL_FIELD_KEY = "portal_link";
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isPortalUrlSyncConfigured", () => {
  it("is configured when both an API token and a field key are set", () => {
    expect(isPortalUrlSyncConfigured()).toBe(true);
  });

  it("is not configured without an API token", () => {
    delete process.env.GHL_API_TOKEN;
    expect(isPortalUrlSyncConfigured()).toBe(false);
  });
});

describe("syncPortalUrlToHighLevel", () => {
  it("sends the portal link as a keyed custom field on the exact contact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncPortalUrlToHighLevel("contact-123", "https://example.com/p/abc");

    expect(result).toEqual({ ok: true, skipped: false, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/contact-123");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string);
    expect(body.customFields).toEqual([{ key: "portal_link", field_value: "https://example.com/p/abc" }]);
  });

  it("is skipped (not an error) when unconfigured", async () => {
    delete process.env.GHL_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncPortalUrlToHighLevel("contact-123", "https://example.com/p/abc");

    expect(result).toEqual({ ok: false, skipped: true, error: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a non-2xx HighLevel response as a non-fatal error, not a thrown exception", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("field not found", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncPortalUrlToHighLevel("contact-123", "https://example.com/p/abc");

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toContain("422");
  });

  it("reports a network failure as a non-fatal error, not a thrown exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await syncPortalUrlToHighLevel("contact-123", "https://example.com/p/abc");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });
});
