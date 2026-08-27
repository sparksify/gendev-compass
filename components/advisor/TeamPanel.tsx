"use client";

import { useEffect, useState } from "react";
import { GridHead, GridRow, Panel, Pill } from "@/components/advisor/v3";
import { ACCENT_BUTTON, FIELD, FIELD_LABEL, SECONDARY_BUTTON } from "@/components/advisor/controls";

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

/** name · email · role · last login */
const COLS = "1fr 1.4fr .7fr 1fr";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function initialsOf(user: StaffUserSummary): string {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() || "?";
}

/** A form's result line — green when it worked, red when it didn't. */
function FormMessage({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={`text-[12.5px] font-semibold ${message.ok ? "text-success" : "text-destructive"}`}
    >
      {message.text}
    </p>
  );
}

function Field({
  label,
  hint,
  span,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className={FIELD_LABEL}>
        {label}
        {hint && <span className="font-medium text-faint-foreground"> ({hint})</span>}
      </label>
      <input className={FIELD} {...props} />
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (user: StaffUserSummary) => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "ADVISOR",
  });
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
    <form onSubmit={submit}>
      <div className="mt-3 grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
        <Field
          label="First name"
          required
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
        <Field
          label="Last name"
          required
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
        <Field
          label="Email"
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <div>
          <label className={FIELD_LABEL} htmlFor="new-member-role">
            Role
          </label>
          <select
            id="new-member-role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={`${FIELD} font-semibold`}
          >
            <option value="ADVISOR">Advisor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <Field
          span
          label="Temporary password"
          hint="12+ characters — they should change it after first login"
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={ACCENT_BUTTON}>
          {busy ? "Creating…" : "＋ Add Team Member"}
        </button>
        <FormMessage message={message} />
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
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setForm({ currentPassword: "", newPassword: "", confirm: "" });
        setMessage({ ok: true, text: "Password changed." });
      } else {
        const detail = data.details ? Object.values(data.details).flat().join(" ") : "";
        setMessage({
          ok: false,
          text: `${data.error ?? "Could not change password."} ${detail}`.trim(),
        });
      }
    } catch {
      setMessage({ ok: false, text: "Request failed. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="mt-3 grid max-w-[640px] grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
        <Field
          span
          label="Current password"
          required
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
        />
        <Field
          label="New password"
          hint="12+ characters"
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
        />
        <Field
          label="Confirm new password"
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
        />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={SECONDARY_BUTTON}>
          {busy ? "Saving…" : "Update Password"}
        </button>
        <FormMessage message={message} />
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
    <>
      {isAdminUser && (
        <>
          <Panel>
            <p className="text-[15px] font-bold text-foreground">Team Members</p>
            {error && <p className="mt-2 text-[12.5px] text-destructive">{error}</p>}

            <div className="mt-1 overflow-x-auto">
              <div className="min-w-[620px]">
                <GridHead columns={COLS}>
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Last Login</span>
                </GridHead>

                {users === null && !error && (
                  <p className="py-3 text-[12.5px] text-muted-foreground">Loading…</p>
                )}

                {users?.map((user, index) => (
                  <GridRow key={user.id} columns={COLS} last={index === users.length - 1}>
                    <span className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-bold text-foreground">
                      <span
                        aria-hidden
                        className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                          user.role === "ADMIN"
                            ? "bg-[#fff6d9] text-accent-strong"
                            : "bg-primary-soft text-primary"
                        }`}
                      >
                        {initialsOf(user)}
                      </span>
                      <span className="truncate">
                        {user.first_name} {user.last_name}
                        {!user.active && (
                          <span className="ml-1.5 font-semibold text-faint-foreground">
                            (inactive)
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="truncate text-[13px] font-medium text-secondary-foreground">
                      {user.email}
                    </span>
                    <span>
                      <Pill
                        tone={user.role === "ADMIN" ? "neutral" : "info"}
                        className={`tracking-[0.05em] ${
                          user.role === "ADMIN" ? "bg-primary-soft text-primary" : ""
                        }`}
                      >
                        {user.role}
                      </Pill>
                    </span>
                    <span className="truncate text-[12.5px] font-semibold text-muted-foreground">
                      {formatWhen(user.last_login_at)}
                    </span>
                  </GridRow>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <p className="text-[15px] font-bold text-foreground">Add Team Member</p>
            <CreateUserForm
              onCreated={(user) => setUsers((prev) => (prev ? [...prev, user] : [user]))}
            />
          </Panel>
        </>
      )}

      <Panel>
        <p className="text-[15px] font-bold text-foreground">My Password</p>
        <p className="mt-[3px] text-[12.5px] font-medium text-muted-foreground">
          Change the password you use to sign in to this dashboard.
        </p>
        <ChangePasswordForm />
      </Panel>
    </>
  );
}
