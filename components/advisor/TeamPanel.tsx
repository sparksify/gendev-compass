"use client";

import { useEffect, useState } from "react";

interface StaffUserSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "ADMIN" | "ADVISOR";
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const INPUT_CLASS =
  "mt-1 block w-full rounded-control border-2 border-border-strong bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function CreateUserForm({ onCreated }: { onCreated: (user: StaffUserSummary) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "ADVISOR" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/advisor/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (data.success) {
        onCreated(data.user);
        setForm({ firstName: "", lastName: "", email: "", password: "", role: "ADVISOR" });
        setMessage({ ok: true, text: `Created ${data.user.email}.` });
      } else {
        const detail = data.details ? Object.values(data.details).flat().join(" ") : "";
        setMessage({ ok: false, text: `${data.error ?? "Could not create user."} ${detail}`.trim() });
      }
    } catch {
      setMessage({ ok: false, text: "Request failed. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-secondary-foreground">
          First name
          <input
            required
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-secondary-foreground">
          Last name
          <input
            required
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-secondary-foreground">
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-secondary-foreground">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={INPUT_CLASS}
          >
            <option value="ADVISOR">Advisor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-secondary-foreground">
          Temporary password (12+ characters — they should change it after first login)
          <input
            required
            type="password"
            minLength={12}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className={INPUT_CLASS}
            autoComplete="new-password"
          />
        </label>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Creating…" : "Add Team Member"}
        </button>
        {message && (
          <p className={`text-xs font-medium ${message.ok ? "text-success" : "text-destructive"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMessage({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/advisor/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        setForm({ currentPassword: "", newPassword: "", confirm: "" });
        setMessage({ ok: true, text: "Password changed." });
      } else {
        const detail = data.details ? Object.values(data.details).flat().join(" ") : "";
        setMessage({ ok: false, text: `${data.error ?? "Could not change password."} ${detail}`.trim() });
      }
    } catch {
      setMessage({ ok: false, text: "Request failed. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid max-w-md grid-cols-1 gap-3">
      <label className="text-xs font-medium text-secondary-foreground">
        Current password
        <input
          required
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          className={INPUT_CLASS}
          autoComplete="current-password"
        />
      </label>
      <label className="text-xs font-medium text-secondary-foreground">
        New password (12+ characters)
        <input
          required
          type="password"
          minLength={12}
          value={form.newPassword}
          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          className={INPUT_CLASS}
          autoComplete="new-password"
        />
      </label>
      <label className="text-xs font-medium text-secondary-foreground">
        Confirm new password
        <input
          required
          type="password"
          minLength={12}
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          className={INPUT_CLASS}
          autoComplete="new-password"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Saving…" : "Change Password"}
        </button>
        {message && (
          <p className={`text-xs font-medium ${message.ok ? "text-success" : "text-destructive"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

/** Team management: staff list, add member (admin), change own password. */
export function TeamPanel({ isAdminUser }: { isAdminUser: boolean }) {
  const [users, setUsers] = useState<StaffUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminUser) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/advisor/users");
        const data = await response.json();
        if (cancelled) return;
        if (data.success) setUsers(data.users);
        else setError(data.error ?? "Could not load team.");
      } catch {
        if (!cancelled) setError("Could not load team.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminUser]);

  return (
    <div className="space-y-4">
      {isAdminUser && (
        <div className="rounded-card border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody>
                {users === null && !error && (
                  <tr>
                    <td colSpan={4} className="py-3 text-xs text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {users?.map((user) => (
                  <tr key={user.id} className="border-b border-border-soft">
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {user.first_name} {user.last_name}
                      {!user.active && <span className="ml-2 text-[11px] text-muted-foreground">(inactive)</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-secondary-foreground">{user.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{formatWhen(user.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-foreground">Add Team Member</h3>
          <CreateUserForm
            onCreated={(user) => setUsers((prev) => (prev ? [...prev, user] : [user]))}
          />
        </div>
      )}

      <div className="rounded-card border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">My Password</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Change the password you use to sign in to this dashboard.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
