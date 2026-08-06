"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, MapPin, ArrowRight, Map as MapIcon, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-fields";
import { HeroBackdrop } from "@/components/dashboard/HeroBackdrop";
import { LiveTerritoryMap } from "./LiveTerritoryMap";
import { FloatingMarketPanel } from "./FloatingMarketPanel";
import { TerritoryAssessment } from "./TerritoryAssessment";
import { WhyThisMarket } from "./WhyThisMarket";
import { ChatMessage } from "./ChatMessage";
import { ReviewRequestModal } from "./ReviewRequestModal";
import { Disclaimer } from "./Disclaimer";
import { STATUS_META } from "./statusMeta";
import { cn } from "@/lib/utils";
import { RADIUS_OPTIONS_MILES } from "@/lib/config/territory";
import { availabilitySignal } from "@/lib/territory/briefing";
import type { CtaAction } from "./cta";
import type { ChatMessageData } from "./types";
import type { TerritoryAlternative, TerritoryEvaluationResult, TerritoryResultStatus } from "@/types/territory";

const LOADING_PHRASES = [
  "Finding your market…",
  "Checking state eligibility…",
  "Comparing current territory records…",
  "Preparing your preliminary result…",
];

const POPULAR_MARKETS = ["Dallas, TX", "Austin, TX", "Nashville, TN", "Phoenix, AZ", "Tampa, FL"];

/** Statuses that represent a completed market evaluation. */
const EVALUATED_STATUSES: TerritoryResultStatus[] = [
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
  "UNAVAILABLE",
  "STATE_RESTRICTED",
  "MANUAL_REVIEW",
];

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

interface TerritoryAdvisorClientProps {
  token: string;
  firstName: string;
  brandName: string;
  advisorName: string;
  advisorEmail: string;
  /** Compact brand context for the workspace header (replaces the rail card). */
  brandContext: { industry: string | null; investmentRange: string | null };
  defaultRadiusMiles: number;
  initialResults: TerritoryEvaluationResult[];
}

/**
 * The Territory Intelligence workstation: a split workspace where the
 * conversation drives the map. Chat (left) and live map (right) stay
 * visible together — only the conversation history scrolls, the input is
 * pinned, and the Market Analysis panel floats on the map. The advisor is
 * introduced in the conversation after a result (not before), and brand
 * context shrinks to one header line. Tablet stacks map above chat; mobile
 * leads with the conversation and makes the map expandable.
 */
export function TerritoryAdvisorClient({
  token,
  firstName,
  brandName,
  advisorName,
  advisorEmail,
  brandContext,
  defaultRadiusMiles,
  initialResults,
}: TerritoryAdvisorClientProps) {
  const base = `/p/${token}`;
  const mostRecent = initialResults[0] ?? null;

  const [messages, setMessages] = useState<ChatMessageData[]>(() => [
    {
      id: nextId(),
      role: "advisor",
      text: `Hi, ${firstName}.\n\nTell me the city, ZIP code, or general area you are interested in, and I'll check its preliminary availability for ${brandName}.`,
    },
    ...[...initialResults].reverse().map(
      (r): ChatMessageData => ({ id: nextId(), role: "advisor", text: r.message, result: r }),
    ),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(mostRecent?.evaluation.radiusMiles || defaultRadiusMiles);
  const [lastResult, setLastResult] = useState<TerritoryEvaluationResult | null>(mostRecent);
  const [submitting, setSubmitting] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ open: boolean; searchId: string | null; location: string | null }>(
    { open: false, searchId: null, location: null },
  );
  const [geoBusy, setGeoBusy] = useState(false);
  // Mobile: conversation first, map expandable. Tablet/desktop: map always on.
  const [isMdUp, setIsMdUp] = useState(true);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMdUp(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, lastResult]);

  useEffect(() => () => {
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
  }, []);

  function pushMessage(message: Omit<ChatMessageData, "id">) {
    setMessages((prev) => [...prev, { id: nextId(), ...message }]);
  }

  function startLoading(): string {
    const id = nextId();
    let phraseIndex = 0;
    setMessages((prev) => [...prev, { id, role: "advisor", loadingLabel: LOADING_PHRASES[0] }]);
    loadingTimerRef.current = setInterval(() => {
      phraseIndex = Math.min(phraseIndex + 1, LOADING_PHRASES.length - 1);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, loadingLabel: LOADING_PHRASES[phraseIndex] } : m)));
    }, 900);
    return id;
  }

  function stopLoading(id: string) {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function runSearch(payload: Record<string, unknown>, userText: string | null) {
    if (submitting) return;
    setSubmitting(true);
    if (userText) pushMessage({ role: "user", text: userText });
    const loadingId = startLoading();

    try {
      const response = await fetch(`/api/portal/${token}/territory-advisor/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      stopLoading(loadingId);

      if (!response.ok || !data.success) {
        pushMessage({ role: "advisor", text: data.error ?? "We couldn't complete that check. Please try again.", isError: true });
        return;
      }

      if (data.kind === "alternatives") {
        pushMessage({ role: "advisor", text: data.message, alternatives: data.alternatives });
        return;
      }

      const result: TerritoryEvaluationResult = data.result;
      pushMessage({ role: "advisor", text: result.message, result });
      setLastResult(result);
      if (result.evaluation.radiusMiles > 0) setRadiusMiles(result.evaluation.radiusMiles);
    } catch {
      stopLoading(loadingId);
      pushMessage({
        role: "advisor",
        text: "We couldn't reach the server. Please check your connection and try again.",
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitText(rawText: string, origin: "text" | "chip" | "candidate" | "alternative" = "text") {
    const text = rawText.trim();
    if (!text || submitting) return;
    setInputValue("");
    void runSearch({ query: text, origin }, text);
  }

  function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    handleSubmitText(inputValue, "text");
  }

  function handleRadiusChange(next: number) {
    setRadiusMiles(next);
    if (!lastResult) return;
    const anchor = lastResult.location.zipCode ?? lastResult.location.displayName ?? lastResult.location.query;
    void runSearch({ query: anchor, radiusMiles: next, origin: "chip" }, `Check ${next} miles around ${lastResult.location.displayName ?? anchor}`);
  }

  function handleAction(action: CtaAction, result: TerritoryEvaluationResult) {
    switch (action) {
      case "requestReview":
        setReviewModal({ open: true, searchId: result.searchId, location: result.location.displayName });
        return;
      case "checkAnother":
        setInputValue("");
        inputRef.current?.focus();
        return;
      case "exploreNearby":
        void runSearch({ query: "what nearby markets are open", origin: "text" }, "What nearby markets are open?");
        return;
      case "viewOpportunities":
        window.location.href = `${base}/opportunity`;
        return;
      case "contactAdvisor":
        window.location.href = `mailto:${advisorEmail}`;
        return;
    }
  }

  function handleSelectAlternative(alt: TerritoryAlternative) {
    handleSubmitText(alt.zipCode ?? alt.label, "alternative");
  }

  function handleSelectCandidate(candidate: { label: string }) {
    handleSubmitText(candidate.label, "candidate");
  }

  function handleUseCurrentCity() {
    if (submitting || geoBusy) return;
    if (!("geolocation" in navigator)) {
      pushMessage({ role: "advisor", text: "This browser doesn't support location sharing — try entering a city or ZIP instead.", isError: true });
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoBusy(false);
        void runSearch(
          { latitude: position.coords.latitude, longitude: position.coords.longitude, origin: "current_location" },
          "Use my current location",
        );
      },
      () => {
        setGeoBusy(false);
        pushMessage({
          role: "advisor",
          text: "We weren't able to access your location. Try entering a city or ZIP code instead.",
          isError: true,
        });
      },
      { timeout: 8000 },
    );
  }

  const evaluated = lastResult != null && EVALUATED_STATUSES.includes(lastResult.status);
  const lastResultMessageId = [...messages].reverse().find((m) => m.result != null)?.id ?? null;
  // The newest exchange starts at the last user message (or the greeting).
  const lastUserIndex = messages.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1);
  const focusStartIndex = lastUserIndex === -1 ? 0 : lastUserIndex;

  // Smart follow-up chips: one click updates chat, map, and analysis together.
  const smartChips: Array<{ key: string; label: string; onClick: () => void }> = [];
  if (evaluated && lastResult) {
    for (const alt of lastResult.alternatives.filter((a) => a.status === "AVAILABLE").slice(0, 3)) {
      smartChips.push({
        key: `compare-${alt.label}`,
        label: `Compare ${alt.city ?? alt.label}`,
        onClick: () => handleSelectAlternative(alt),
      });
    }
    const nextRadius = RADIUS_OPTIONS_MILES.filter((option) => option > radiusMiles).sort((a, b) => a - b)[0];
    if (nextRadius && lastResult.status !== "STATE_RESTRICTED") {
      smartChips.push({
        key: "expand-radius",
        label: `Expand to ${nextRadius} mi`,
        onClick: () => handleRadiusChange(nextRadius),
      });
    }
    if (lastResult.status === "UNAVAILABLE" || lastResult.status === "PARTIALLY_AVAILABLE") {
      smartChips.push({
        key: "nearby",
        label: "Search nearby markets",
        onClick: () => handleAction("exploreNearby", lastResult),
      });
    }
    if (lastResult.status === "AVAILABLE") {
      smartChips.push({
        key: "opportunity",
        label: "Review opportunity overview",
        onClick: () => handleAction("viewOpportunities", lastResult),
      });
      smartChips.push({
        key: "qualification",
        label: "Begin qualification",
        onClick: () => {
          window.location.href = `${base}/questionnaire`;
        },
      });
    }
    if (lastResult.status === "STATE_RESTRICTED") {
      smartChips.push({
        key: "other-opportunities",
        label: "View other opportunities",
        onClick: () => handleAction("viewOpportunities", lastResult),
      });
    }
    smartChips.push({
      key: "new-search",
      label: "Search another area",
      onClick: () => {
        setInputValue("");
        inputRef.current?.focus();
      },
    });
  }

  const showMapPane = isMdUp || mobileMapOpen;

  // Header-only bindings — a restatement of state already computed above,
  // never new data: the availability badge/confidence shown in the
  // workspace header, once a search has completed.
  const headerStatusMeta = evaluated && lastResult ? STATUS_META[lastResult.status] : null;
  const headerSignal = evaluated && lastResult ? availabilitySignal(lastResult) : null;
  const headerLocation = evaluated && lastResult ? (lastResult.location.displayName ?? lastResult.location.query) : null;

  return (
    <div className="ti-workspace flex flex-col gap-4">
      {/* Workspace header: institutional hero matching the redesigned
          investor dashboard — compact, since this is an operational tool,
          not a marketing moment. */}
      <div className="relative overflow-hidden rounded-card border border-border bg-card px-6 py-5 shadow-card sm:px-7">
        <HeroBackdrop />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-gold">
              Territory Advisor
            </p>
            <h1 className="mt-1 font-serif text-[24px] font-medium leading-[1.15] text-sidebar sm:text-[26px]">
              Check Territory Availability
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-[1.55] text-muted-foreground">
              Search by city or ZIP code to identify whether an area appears open for purchase. This
              is a preliminary territory check; final availability must be confirmed by GenDev and
              the franchisor.
            </p>
            <p className="mt-3 text-[12px] text-secondary-foreground">
              <span className="font-semibold">{brandName}</span>
              {headerLocation && <> · {headerLocation}</>}
              {" · "}
              {radiusMiles}-mile radius
            </p>
          </div>

          {headerStatusMeta && headerSignal && lastResult && (
            <div className="shrink-0 lg:w-[230px] lg:border-l lg:border-border lg:pl-7">
              <Badge className={cn("gap-1.5 px-2.5 py-1 text-[12.5px] font-medium", headerStatusMeta.badgeClass)}>
                <headerStatusMeta.icon className="size-3.5" strokeWidth={2} />
                {headerStatusMeta.label}
              </Badge>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Preliminary territory check · {headerSignal.percent}% confidence
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction("checkAnother", lastResult)}
                >
                  Check Another Area
                </Button>
                <Button
                  size="sm"
                  className="bg-sidebar text-white hover:bg-sidebar/90"
                  onClick={() => handleAction("requestReview", lastResult)}
                >
                  Request Territory Review
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split workspace: conversation | live map. Fixed height on desktop so
          the core loop needs no page scrolling; only chat history scrolls. */}
      <div className="flex flex-col gap-4 lg:grid lg:h-[calc(100dvh-228px)] lg:min-h-[480px] lg:grid-cols-[minmax(320px,2fr)_3fr]">
        {/* Conversation pane */}
        <Card className="order-1 flex min-h-0 min-w-0 flex-col md:order-2 lg:order-none lg:h-full">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint-foreground">
              AI Territory Analysis
            </p>
            <button
              type="button"
              onClick={() => setMobileMapOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] font-medium text-secondary-foreground md:hidden"
            >
              {mobileMapOpen ? <X className="size-3.5" strokeWidth={1.8} /> : <MapIcon className="size-3.5" strokeWidth={1.8} />}
              {mobileMapOpen ? "Hide map" : "View map"}
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-[52dvh] min-h-[280px] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 lg:max-h-none"
          >
            {messages.map((message, index) => (
              // History stays, but the newest exchange is the focus: earlier
              // messages sit at reduced weight (hover restores them), and
              // each new search opens with a little extra breathing room.
              <div
                key={message.id}
                className={cn(
                  "transition-opacity duration-300",
                  index < focusStartIndex && "opacity-60 hover:opacity-100",
                  index > 0 && message.role === "user" && "mt-2",
                )}
              >
                <ChatMessage
                  message={message}
                  disabled={submitting}
                  hideCtas={message.id === lastResultMessageId}
                  onAction={(action) => message.result && handleAction(action, message.result)}
                  onSelectCandidate={handleSelectCandidate}
                  onSelectAlternative={handleSelectAlternative}
                />
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                  Popular Markets
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_MARKETS.map((market) => (
                    <button
                      key={market}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmitText(market, "chip")}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      {market}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={submitting || geoBusy}
                    onClick={handleUseCurrentCity}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    <MapPin className="size-3.5" strokeWidth={1.8} />
                    {geoBusy ? "Locating…" : "Use my current city"}
                  </button>
                </div>
              </div>
            )}

            {/* Smart follow-ups for the latest result — no retyping needed. */}
            {!submitting && smartChips.length > 0 && (
              <div className="ti-fade-up flex flex-col gap-2 pl-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint-foreground">
                  Recommended next steps
                </p>
                <div className="flex flex-wrap gap-2">
                {smartChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    disabled={submitting}
                    onClick={chip.onClick}
                    className="rounded-full border border-primary-soft-border bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
                </div>
              </div>
            )}

            {/* The advisor enters the conversation as the next logical step —
                only after the prospect has a result to talk about. */}
            {!submitting && evaluated && lastResult && (
              <div className="ti-fade-up rounded-control border border-primary-soft-border bg-primary-soft/40 px-3.5 py-3">
                <p className="text-[13px] leading-relaxed text-foreground">
                  Would you like <span className="font-semibold">{advisorName}</span> to review{" "}
                  {lastResult.location.displayName ?? "this market"} with you? Reviews typically come back
                  within one business day.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2.5"
                  disabled={submitting}
                  onClick={() =>
                    setReviewModal({
                      open: true,
                      searchId: lastResult.searchId,
                      location: lastResult.location.displayName,
                    })
                  }
                >
                  Schedule Territory Review <ArrowRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Pinned composer: never disappears. */}
          <div className="border-t border-border px-4 py-3">
            {lastResult && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-muted-foreground">Evaluation radius:</span>
                {RADIUS_OPTIONS_MILES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRadiusChange(option)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50",
                      option === radiusMiles
                        ? "border-primary-soft-border bg-primary-soft text-primary"
                        : "border-border text-muted-foreground hover:bg-surface",
                    )}
                  >
                    {option} mi
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search city or ZIP…"
                disabled={submitting}
                list="ti-market-suggestions"
                aria-label="Search city or ZIP"
              />
              <datalist id="ti-market-suggestions">
                {POPULAR_MARKETS.map((market) => (
                  <option key={market} value={market} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={submitting || geoBusy}
                onClick={handleUseCurrentCity}
                title="Use my current location"
                aria-label="Use my current location"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-border text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
              >
                <MapPin className="size-4" strokeWidth={1.8} />
              </button>
              <Button type="submit" disabled={submitting || !inputValue.trim()}>
                <Search className="size-4" strokeWidth={1.8} />
                <span className="hidden sm:inline">Check Territory</span>
              </Button>
            </form>
          </div>
        </Card>

        {/* Live map pane with the floating Market Analysis panel. */}
        {showMapPane && (
          <div className="relative isolate order-2 h-[320px] min-h-0 md:order-1 md:h-[400px] lg:order-none lg:h-full">
            <LiveTerritoryMap
              token={token}
              result={lastResult}
              onSelectAlternative={handleSelectAlternative}
              disabled={submitting}
              fill
            />
            {evaluated && lastResult && (
              <div key={lastResult.checkedAt} className="absolute right-3 top-3 z-[650] hidden md:block">
                <FloatingMarketPanel result={lastResult} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deep dive: optional exploration below the workspace. The core loop
          never requires scrolling here. */}
      {evaluated && lastResult && (
        <div key={`briefing-${lastResult.checkedAt}`} className="grid gap-4 lg:grid-cols-2">
          <TerritoryAssessment result={lastResult} />
          <WhyThisMarket result={lastResult} />
        </div>
      )}
      <Card className="p-4">
        <Disclaimer />
      </Card>
      <p className="px-1 text-[12px] text-muted-foreground">
        Have questions about this feature?{" "}
        <Link href={`${base}#faq`} className="text-primary hover:text-primary-hover">
          Visit the Investor FAQ
        </Link>
        .
      </p>

      <ReviewRequestModal
        open={reviewModal.open}
        onOpenChange={(open) => setReviewModal((prev) => ({ ...prev, open }))}
        token={token}
        brandName={brandName}
        locationLabel={reviewModal.location}
        territorySearchId={reviewModal.searchId}
      />
    </div>
  );
}
