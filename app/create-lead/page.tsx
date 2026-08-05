"use client";

import { useState } from "react";
import {
  BUSINESS_OWNERSHIP_OPTIONS,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
} from "@/types/questionnaire";

/**
 * Open colleague-testing page: generates a personalized portal link with
 * no admin password. Leads created here are always tagged
 * source=colleague-test so they never mix with real ad-driven leads.
 */

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10";
const labelClass = "block text-sm font-medium text-gray-800";

export default function PublicCreateLeadPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setPortalUrl(null);
    setCopied(false);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: (form.get("phone") as string) || undefined,
      state: (form.get("state") as string) || undefined,
      liquidCapital: (form.get("liquidCapital") as string) || undefined,
      netWorth: (form.get("netWorth") as string) || undefined,
      ownedBusinessBefore:
        form.get("businessOwnership") === "" ? undefined : form.get("businessOwnership") !== "no",
    };

    try {
      const response = await fetch("/api/test-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        success: boolean;
        portalUrl?: string;
        error?: string;
      };
      if (data.success && data.portalUrl) {
        setPortalUrl(data.portalUrl);
      } else {
        setError(data.error ?? "Lead creation failed.");
      }
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-gray-900">Create a Test Portal Link</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter your details to generate a personalized investor portal experience. Test links are
        tagged separately from real leads.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>
              First name
            </label>
            <input id="firstName" name="firstName" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>
              Last name
            </label>
            <input id="lastName" name="lastName" required className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input id="phone" name="phone" type="tel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="state" className={labelClass}>
              State
            </label>
            <input id="state" name="state" className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="liquidCapital" className={labelClass}>
            Liquid capital
          </label>
          <select id="liquidCapital" name="liquidCapital" defaultValue="" className={inputClass}>
            <option value="">Not provided</option>
            {LIQUID_CAPITAL_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="netWorth" className={labelClass}>
            Net worth
          </label>
          <select id="netWorth" name="netWorth" defaultValue="" className={inputClass}>
            <option value="">Not provided</option>
            {NET_WORTH_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="businessOwnership" className={labelClass}>
            Business ownership experience
          </label>
          <select
            id="businessOwnership"
            name="businessOwnership"
            defaultValue=""
            className={inputClass}
          >
            <option value="">Not provided</option>
            {BUSINESS_OWNERSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Generate My Portal Link"}
        </button>
      </form>

      {portalUrl && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">Portal link created</p>
          <p className="mt-2 break-all rounded bg-white p-2 font-mono text-xs text-gray-800">
            {portalUrl}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-100"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open portal
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
