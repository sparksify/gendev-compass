"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminSections } from "@/components/adminSections/AdminSections";

/**
 * Legacy standalone admin page, gated by ADMIN_TEST_PASSWORD. The same
 * toolset now lives inside the unified staff dashboard at
 * /advisor/platform (staff ADMIN login) — this page remains as a
 * password-based fallback. Both render components/adminSections.
 */
export default function AdminDashboardPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => ({ "x-admin-password": password }), [password]);

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assets", { headers: authHeaders });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) setUnlocked(true);
      else setError(data.error ?? "Incorrect password.");
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-gray-900">Portal Admin</h1>
      <p className="mt-1 text-sm text-gray-500">
        Platform tools: branding, FDD workflow, territory data, test leads. Also available inside
        the staff dashboard at{" "}
        <Link href="/advisor/platform" className="text-blue-600 hover:underline">
          /advisor/platform
        </Link>
        .
      </p>

      {!unlocked ? (
        <form onSubmit={unlock} className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-800">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              autoComplete="off"
            />
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
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Open Dashboard"}
          </button>
        </form>
      ) : (
        <div className="mt-8">
          <AdminSections authHeaders={authHeaders} />
        </div>
      )}
    </main>
  );
}
