"use client";

import { useEffect, useState } from "react";
import { SectionRule } from "@/components/advisor/PageHeader";
import { DISCOVERY_STAGES, SIGNAL } from "@/lib/advisor/discoveryStages";

interface DiagnosticsPayload {
  status: { gtm: string; metaBrowser: string; metaCapi: string };
  lastEvents: {
    portalEvent: string | null;
    metaBrowserEvent: string | null;
    metaServerEvent: string | null;
  };
  counts: {
    eventsToday: number;
    serverEventsFailedToday: number;
    browserEventsFailedToday: number;
    deduplicatedEvents: number;
  };
  log: Array<{
    id: string;
    timestamp: string;
    prospect: string;
    portalEvent: string;
    eventId: string;
    provider: string;
    status: string;
    responseCode: number | null;
  }>;
}

const PROVIDER_LABEL: Record<string, string> = {
  gtm: "GTM",
  meta_browser: "Meta Pixel",
  meta_capi: "Meta CAPI",
};

interface EventSummary {
  eventName: string;
  destinations: string;
  state: "ok" | "retried" | "failed" | "suppressed";
}

/** One row per portal event: where it went and whether it landed. */
function summarize(log: DiagnosticsPayload["log"]): EventSummary[] {
  const byEvent = new Map<string, { providers: Set<string>; statuses: Set<string> }>();
  for (const row of log) {
    const entry = byEvent.get(row.portalEvent) ?? { providers: new Set(), statuses: new Set() };
    entry.providers.add(PROVIDER_LABEL[row.provider] ?? row.provider);
    entry.statuses.add(row.status);
    byEvent.set(row.portalEvent, entry);
  }
  return [...byEvent.entries()].slice(0, 8).map(([eventName, entry]) => ({
    eventName,
    destinations: [...entry.providers].join(" + "),
    state: entry.statuses.has("failed")
      ? "failed"
      : entry.statuses.has("suppressed")
        ? "suppressed"
        : entry.statuses.has("test") && entry.statuses.size > 1
          ? "retried"
          : "ok",
  }));
}

const STATE_TONE: Record<EventSummary["state"], { color: string; label: string }> = {
  ok: { color: SIGNAL.success, label: "ok" },
  retried: { color: SIGNAL.warning, label: "retried · ok" },
  failed: { color: SIGNAL.alert, label: "failed" },
  suppressed: { color: SIGNAL.warning, label: "suppressed" },
};

/**
 * Delivery diagnostics as the right rail of Tracking & Pixels (handoff mock
 * 8b): one row per event with its destinations and state, a 24-hour volume
 * card, and the security footnote. Never renders access tokens.
 */
export function TrackingDiagnostics({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/tracking/diagnostics", { headers: authHeaders });
        const json = await response.json();
        if (cancelled) return;
        if (!json.success) {
          setError(json.error ?? "Could not load diagnostics.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Could not load diagnostics.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // authHeaders is a fresh object each render; the values never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <p
        className="rounded-card border px-4 py-3 text-xs"
        style={{ borderColor: "#fda29b", backgroundColor: SIGNAL.alertTint, color: SIGNAL.alert }}
      >
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-xs text-muted-foreground">Loading…</p>;

  const events = summarize(data.log);
  const gtmCount = data.log.filter((row) => row.provider === "gtm").length;
  const capiCount = data.log.filter((row) => row.provider === "meta_capi").length;
  const browserCount = data.log.filter((row) => row.provider === "meta_browser").length;
  const failed = data.counts.serverEventsFailedToday + data.counts.browserEventsFailedToday;
  const total = data.counts.eventsToday;
  const okPercent = total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : 100;

  return (
    <div>
      <SectionRule label="Delivery diagnostics" meta="last 24h" className="mb-1.5" />
      {events.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No delivery events yet.</p>
      ) : (
        <div className="flex flex-col text-xs">
          {events.map((event) => {
            const tone = STATE_TONE[event.state];
            return (
              <span
                key={event.eventName}
                className="flex items-center gap-2 border-b border-border-soft py-2.5 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tone.color }}
                />
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                  {event.eventName}
                </span>
                <span className="shrink-0 text-faint-foreground">{event.destinations}</span>
                <span className="shrink-0 font-bold" style={{ color: tone.color }}>
                  {tone.label}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-5 rounded-card border border-border px-4 py-3.5">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-faint-foreground">
          Events delivered · 24h
        </p>
        <p className="tabular mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-foreground">
          {total}{" "}
          <span
            className="text-xs font-semibold"
            style={{ color: failed === 0 ? SIGNAL.success : SIGNAL.warning }}
          >
            {okPercent}% ok
          </span>
        </p>
        {total > 0 && (
          <>
            <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
              <span style={{ flex: gtmCount, backgroundColor: DISCOVERY_STAGES[0].color }} />
              <span style={{ flex: capiCount, backgroundColor: DISCOVERY_STAGES[1].color }} />
              <span style={{ flex: browserCount, backgroundColor: DISCOVERY_STAGES[2].color }} />
              <span style={{ flex: Math.max(failed, 0.001), backgroundColor: SIGNAL.warning }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10.5px] text-muted-foreground">
              <span>
                <strong className="font-bold" style={{ color: DISCOVERY_STAGES[0].color }}>
                  {gtmCount}
                </strong>{" "}
                GTM
              </span>
              <span>
                <strong className="font-bold" style={{ color: DISCOVERY_STAGES[1].color }}>
                  {capiCount}
                </strong>{" "}
                Meta CAPI
              </span>
              <span>
                <strong className="font-bold" style={{ color: DISCOVERY_STAGES[2].color }}>
                  {browserCount}
                </strong>{" "}
                Meta Pixel
              </span>
              <span>
                <strong className="font-bold" style={{ color: SIGNAL.warning }}>
                  {failed}
                </strong>{" "}
                failed
              </span>
              <span>
                <strong className="font-bold text-foreground">
                  {data.counts.deduplicatedEvents}
                </strong>{" "}
                deduplicated
              </span>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint-foreground">
        The CAPI access token never leaves the server. Questionnaire and financial answers are never
        sent to GTM or Meta.
      </p>
    </div>
  );
}
