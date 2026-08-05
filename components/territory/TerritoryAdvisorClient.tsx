"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Hash, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-fields";
import { TerritoryMap } from "./TerritoryMap";
import { ResultSummaryCard } from "./ResultSummaryCard";
import { ChatMessage } from "./ChatMessage";
import { ReviewRequestModal } from "./ReviewRequestModal";
import { Disclaimer } from "./Disclaimer";
import { cn } from "@/lib/utils";
import { RADIUS_OPTIONS_MILES } from "@/lib/config/territory";
import type { CtaAction } from "./cta";
import type { ChatMessageData } from "./types";
import type { TerritoryAlternative, TerritoryEvaluationResult } from "@/types/territory";

const LOADING_PHRASES = [
  "Finding your market…",
  "Checking state eligibility…",
  "Comparing current territory records…",
  "Preparing your preliminary result…",
];

const EXAMPLE_SEARCHES = ["Dallas, Texas", "75214", "Frisco, TX", "Within 10 miles of Nashville"];

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

interface TerritoryAdvisorClientProps {
  token: string;
  firstName: string;
  brandName: string;
  advisorEmail: string;
  defaultRadiusMiles: number;
  initialResults: TerritoryEvaluationResult[];
}

export function TerritoryAdvisorClient({
  token,
  firstName,
  brandName,
  advisorEmail,
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

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

  return (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Left: conversational interface */}
      <Card className="flex min-w-0 flex-col">
        <div className="border-b border-border px-5 py-4">
          <h1 className="text-[17px] font-bold text-foreground">Territory Advisor</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Explore preliminary territory availability for this opportunity. Enter a city, ZIP code, or
            area you would like us to evaluate.
          </p>
        </div>

        <div ref={scrollRef} className="flex max-h-[560px] min-h-[360px] flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              disabled={submitting}
              onAction={(action) => message.result && handleAction(action, message.result)}
              onSelectCandidate={handleSelectCandidate}
              onSelectAlternative={handleSelectAlternative}
            />
          ))}

          {messages.length <= 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                Example searches
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_SEARCHES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitText(example, "chip")}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          {lastResult && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-muted-foreground">Preliminary evaluation area:</span>
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
              placeholder="Enter a city, ZIP code, or market…"
              disabled={submitting}
              aria-label="Enter a city, ZIP code, or market"
            />
            <Button type="submit" disabled={submitting || !inputValue.trim()}>
              <Search className="size-4" strokeWidth={1.8} />
              Check Territory
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting || geoBusy}
              onClick={handleUseCurrentCity}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
            >
              <MapPin className="size-3.5" strokeWidth={1.8} />
              {geoBusy ? "Locating…" : "Use my current city"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => inputRef.current?.focus()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
            >
              <Hash className="size-3.5" strokeWidth={1.8} />
              Search by ZIP code
            </button>
            {lastResult && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setInputValue("");
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.8} />
                Check another market
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Right: map + market summary */}
      <div className="flex min-w-0 flex-col gap-4">
        <TerritoryMap
          status={lastResult?.status ?? null}
          radiusMiles={radiusMiles}
          locationLabel={lastResult?.location.displayName ?? null}
          overlapPercentage={lastResult?.evaluation.overlapPercentage ?? 0}
        />
        {lastResult && lastResult.status !== "LOCATION_NOT_FOUND" && lastResult.status !== "BRAND_NOT_CONFIGURED" && (
          <ResultSummaryCard result={lastResult} />
        )}
        <Card className="p-4">
          <Disclaimer />
        </Card>
        <p className="px-1 text-[12px] text-muted-foreground">
          Have questions about this feature? <Link href={`${base}#faq`} className="text-primary hover:text-primary-hover">Visit the Investor FAQ</Link>.
        </p>
      </div>

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
