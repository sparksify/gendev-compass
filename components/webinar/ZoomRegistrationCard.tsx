"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Video } from "lucide-react";

export function ZoomRegistrationCard({ token, firstName, email, fallbackUrl }: {
  token: string;
  firstName: string;
  email: string;
  fallbackUrl: string;
}) {
  const [status, setStatus] = useState<"registering" | "registered" | "error">("registering");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/portal/${token}/zoom-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "Registration failed");
        if (!active) return;
        setJoinUrl(body.joinUrl ?? null);
        setStatus("registered");
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Registration failed");
        setStatus("error");
      });
    return () => { active = false; };
  }, [token]);

  if (status === "registered") {
    return (
      <div className="rounded-card border border-success/30 bg-success/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-11 text-success" aria-hidden="true" />
        <h2 className="mt-4 font-serif text-2xl text-sidebar">You’re registered for Zoom, {firstName}</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">
          Zoom will email your personal link and calendar options to <strong className="text-foreground">{email}</strong>.
        </p>
        {joinUrl && (
          <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">
            <Video className="size-4" aria-hidden="true" /> View your Zoom link
          </a>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Finish your Zoom registration</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">{error}</p>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">
          Open Zoom registration <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-8">
      <Loader2 className="mx-auto size-10 animate-spin text-accent-gold" aria-hidden="true" />
      <h2 className="mt-4 font-serif text-2xl text-sidebar">Registering you for the Zoom overview…</h2>
      <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">
        We’re using the information you already provided: <strong className="text-foreground">{firstName}</strong> at <strong className="text-foreground">{email}</strong>.
      </p>
    </div>
  );
}
