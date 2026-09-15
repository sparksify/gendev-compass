"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Compass, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { FieldError, Input, Label, NativeSelect, Textarea } from "@/components/ui/form-fields";
import { US_STATES } from "@/lib/geocoding/states";
import { fireBridgeBrowserEvent } from "@/lib/tracking/client";
import { cn } from "@/lib/utils";
import {
  bridgeStepsFor,
  contactStepSchema,
  locationStepSchema,
  type ChoiceKey,
  type ChoiceStep,
  type FitLevel,
} from "@/lib/bridge/assessment";
import { useBridgeVideo } from "./BridgeVideoContext";

/**
 * The 2-minute fit assessment: one question per screen, auto-advancing on
 * a choice, with typed steps (location, contact) validated inline against
 * the same schema the API enforces. On submit the section swaps to the
 * completion screen — two ways forward, ordered by the fit call.
 *
 * With a known lead (/watch/[token]) there is no contact step: the last
 * question carries the optional note and the submit button, and the
 * answers attach to the existing lead.
 */

export interface KnownBridgeLead {
  token: string;
  firstName: string;
}

type FieldKey =
  | ChoiceKey
  | "city"
  | "state"
  | "zip"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "notes";
type Draft = Partial<Record<FieldKey, string>>;
type Errors = Partial<Record<FieldKey, string>>;

interface Completion {
  firstName: string;
  portalUrl: string;
  scheduleUrl: string | null;
  fit: FitLevel;
}

/** Long enough to see the selection land, short enough to feel instant. */
const ADVANCE_DELAY_MS = 220;

const PRIMARY_BUTTON =
  "inline-flex h-[48px] items-center justify-center gap-2.5 rounded-[7px] bg-sidebar px-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_1px_2px_rgb(16_24_40/0.08)] transition-colors hover:bg-sidebar/90 disabled:pointer-events-none disabled:opacity-60";
const OUTLINE_BUTTON =
  "inline-flex h-[48px] items-center justify-center gap-2.5 rounded-[7px] border border-sidebar/40 bg-card px-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-sidebar transition-colors hover:border-sidebar hover:bg-surface";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FitAssessment({ known }: { known?: KnownBridgeLead }) {
  const steps = bridgeStepsFor(Boolean(known));
  const total = steps.length;
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [errors, setErrors] = useState<Errors>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(false);
  const advanceTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const video = useBridgeVideo();

  const step = steps[stepIndex];
  /** With a known lead the final question doubles as the submit screen. */
  const finalKnownStep = Boolean(known) && stepIndex === total - 1;

  // On every screen change: keep the card in view and move focus to the
  // question so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (completion) {
      // The completion screen replaces a form the visitor had scrolled well
      // into — bring its headline into view rather than its footer.
      promptRef.current?.scrollIntoView({ behavior, block: "start" });
    } else {
      const card = cardRef.current;
      if (card && card.getBoundingClientRect().top < 0) {
        card.scrollIntoView({ behavior, block: "start" });
      }
    }
    promptRef.current?.focus({ preventScroll: true });
  }, [stepIndex, completion]);

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const setField = (key: FieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    if (!startedRef.current) {
      startedRef.current = true;
      fireBridgeBrowserEvent("bridge_assessment_started", "BridgeAssessmentStarted", {
        identified_lead: Boolean(known),
      });
    }
  };

  const goBack = () => {
    setSubmitError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => setStepIndex((i) => Math.min(total - 1, i + 1));

  const choose = (key: ChoiceKey, value: string) => {
    if (advanceTimer.current) return;
    setSubmitError(null);
    setField(key, value);
    if (finalKnownStep) return;
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      goNext();
    }, ADVANCE_DELAY_MS);
  };

  const validateLocation = (): boolean => {
    const result = locationStepSchema.safeParse({
      city: draft.city ?? "",
      state: draft.state ?? "",
      zip: draft.zip ?? "",
    });
    if (result.success) return true;
    const fe = result.error.flatten().fieldErrors;
    setErrors({ city: fe.city?.[0], state: fe.state?.[0], zip: fe.zip?.[0] });
    return false;
  };

  const validateContact = (): boolean => {
    const result = contactStepSchema.safeParse({
      firstName: draft.firstName ?? "",
      lastName: draft.lastName ?? "",
      email: draft.email ?? "",
      phone: draft.phone ?? "",
      notes: draft.notes || undefined,
    });
    if (result.success) return true;
    const fe = result.error.flatten().fieldErrors;
    setErrors({
      firstName: fe.firstName?.[0],
      lastName: fe.lastName?.[0],
      email: fe.email?.[0],
      phone: fe.phone?.[0],
      notes: fe.notes?.[0],
    });
    return false;
  };

  const continueFromLocation = (event: FormEvent) => {
    event.preventDefault();
    if (validateLocation()) goNext();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!known && !validateContact()) return;

    // A choice screen skipped somehow (e.g. history navigation) — send them
    // back to it rather than surfacing a server validation error.
    const missing = steps.findIndex((s) => s.kind === "choice" && !draft[s.key]);
    if (missing >= 0) {
      setSubmitError(
        missing === stepIndex
          ? "Choose the answer that fits best to continue."
          : "One answer was skipped — pick it up where you left off.",
      );
      setStepIndex(missing);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const answers = {
      goal: draft.goal,
      role: draft.role,
      timeline: draft.timeline,
      city: draft.city,
      state: draft.state,
      zip: draft.zip,
      investmentLevel: draft.investmentLevel,
      liquidCapital: draft.liquidCapital,
      priority: draft.priority,
      notes: draft.notes?.trim() || undefined,
    };
    const payload = known
      ? answers
      : {
          ...answers,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          video: video.snapshot ?? undefined,
          attribution: {
            url: window.location.href,
            referrer: document.referrer || null,
            fbp: readCookie("_fbp"),
            fbc: readCookie("_fbc"),
          },
          website: honeypot,
        };
    try {
      const response = await fetch(
        known ? `/api/bridge/${known.token}/assessment` : "/api/bridge/assessment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => ({}))) as Partial<Completion> & {
        success?: boolean;
        error?: string;
        token?: string;
      };
      if (!response.ok || !data.success || !data.portalUrl || !data.firstName) {
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      fireBridgeBrowserEvent("bridge_assessment_submitted", "BridgeAssessmentSubmitted", {
        fit: data.fit ?? "standard",
        identified_lead: Boolean(known || data.token),
      });
      // The lead exists now — the player reports to its history from here on.
      if (data.token) video.report({ token: data.token });
      setCompletion({
        firstName: data.firstName,
        portalUrl: data.portalUrl,
        scheduleUrl: data.scheduleUrl ?? null,
        fit: data.fit ?? "standard",
      });
    } catch {
      setSubmitError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (completion) {
    return <CompletionScreen completion={completion} headingRef={promptRef} />;
  }

  return (
    <div>
      <header className="text-center">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-accent-gold">
          Your Next Step
        </p>
        <h2 className="mt-3 font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.01em] text-sidebar sm:text-[36px]">
          Could CMDT Be a Fit for What You’re Looking For?
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.6] text-muted-foreground">
          Answer a few quick questions about your goals, market, timeline, and investment readiness.
        </p>
        <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-[1.6] text-muted-foreground">
          Your answers help us understand what you’re looking for and show you the information most
          relevant to your situation.
        </p>
        <p className="mt-4 text-[13px] font-medium text-foreground">
          Takes about 2 minutes. No obligation.
        </p>
      </header>

      <div
        ref={cardRef}
        className="mt-9 scroll-mt-6 rounded-card border border-border bg-surface shadow-card"
      >
        <div className="px-5 pt-5 sm:px-8 sm:pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Step {stepIndex + 1} of {total}
          </p>
          <Progress
            value={(stepIndex / total) * 100}
            className="mt-2.5 h-[5px] bg-border"
            indicatorClassName="bg-accent-gold"
            aria-label={`Step ${stepIndex + 1} of ${total}`}
          />
        </div>

        <div key={step.key} className="ownership-profile-step px-5 pb-6 pt-7 sm:px-8 sm:pb-8">
          <h3
            ref={promptRef}
            tabIndex={-1}
            className="font-serif text-[22px] font-medium leading-[1.22] text-sidebar outline-none sm:text-[26px]"
          >
            {step.prompt}
          </h3>
          {step.helper && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{step.helper}</p>
          )}

          <div className="mt-6">
            {step.kind === "choice" && !finalKnownStep && (
              <ChoiceList step={step} value={draft[step.key]} onChoose={choose} />
            )}

            {step.kind === "choice" && finalKnownStep && (
              <form onSubmit={submit} noValidate className="space-y-5">
                <ChoiceList step={step} value={draft[step.key]} onChoose={choose} />
                <div>
                  <Label htmlFor="bridge-notes">
                    Anything else you’d like us to know?{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="bridge-notes"
                    className="mt-1.5 min-h-20"
                    maxLength={2000}
                    value={draft.notes ?? ""}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                  <FieldError message={errors.notes} />
                </div>
                {submitError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                )}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(PRIMARY_BUTTON, "w-full sm:w-auto")}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving your answers
                      </>
                    ) : (
                      <>
                        Show Me My Next Step <ArrowRight className="size-4" strokeWidth={2} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {step.kind === "location" && (
              <form onSubmit={continueFromLocation} noValidate className="space-y-4">
                <div>
                  <Label htmlFor="bridge-city">City</Label>
                  <Input
                    id="bridge-city"
                    className="mt-1.5"
                    autoComplete="address-level2"
                    value={draft.city ?? ""}
                    onChange={(e) => setField("city", e.target.value)}
                    aria-invalid={Boolean(errors.city)}
                  />
                  <FieldError message={errors.city} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bridge-state">State</Label>
                    <NativeSelect
                      id="bridge-state"
                      className="mt-1.5"
                      autoComplete="address-level1"
                      value={draft.state ?? ""}
                      onChange={(e) => setField("state", e.target.value)}
                      aria-invalid={Boolean(errors.state)}
                    >
                      <option value="">Select a state</option>
                      {US_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError message={errors.state} />
                  </div>
                  <div>
                    <Label htmlFor="bridge-zip">ZIP Code</Label>
                    <Input
                      id="bridge-zip"
                      className="mt-1.5"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      value={draft.zip ?? ""}
                      onChange={(e) => setField("zip", e.target.value)}
                      aria-invalid={Boolean(errors.zip)}
                    />
                    <FieldError message={errors.zip} />
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className={cn(PRIMARY_BUTTON, "w-full sm:w-auto")}>
                    Continue <ArrowRight className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </form>
            )}

            {step.kind === "contact" && (
              <form onSubmit={submit} noValidate className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bridge-first">First name</Label>
                    <Input
                      id="bridge-first"
                      className="mt-1.5"
                      autoComplete="given-name"
                      value={draft.firstName ?? ""}
                      onChange={(e) => setField("firstName", e.target.value)}
                      aria-invalid={Boolean(errors.firstName)}
                    />
                    <FieldError message={errors.firstName} />
                  </div>
                  <div>
                    <Label htmlFor="bridge-last">Last name</Label>
                    <Input
                      id="bridge-last"
                      className="mt-1.5"
                      autoComplete="family-name"
                      value={draft.lastName ?? ""}
                      onChange={(e) => setField("lastName", e.target.value)}
                      aria-invalid={Boolean(errors.lastName)}
                    />
                    <FieldError message={errors.lastName} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bridge-email">Email</Label>
                    <Input
                      id="bridge-email"
                      type="email"
                      className="mt-1.5"
                      autoComplete="email"
                      inputMode="email"
                      value={draft.email ?? ""}
                      onChange={(e) => setField("email", e.target.value)}
                      aria-invalid={Boolean(errors.email)}
                    />
                    <FieldError message={errors.email} />
                  </div>
                  <div>
                    <Label htmlFor="bridge-phone">Phone</Label>
                    <Input
                      id="bridge-phone"
                      type="tel"
                      className="mt-1.5"
                      autoComplete="tel"
                      inputMode="tel"
                      value={draft.phone ?? ""}
                      onChange={(e) => setField("phone", e.target.value)}
                      aria-invalid={Boolean(errors.phone)}
                    />
                    <FieldError message={errors.phone} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bridge-notes">
                    Anything else you’d like us to know?{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="bridge-notes"
                    className="mt-1.5 min-h-20"
                    maxLength={2000}
                    value={draft.notes ?? ""}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                  <FieldError message={errors.notes} />
                </div>

                {/* Honeypot: invisible to people, tempting to bots. */}
                <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
                  <label>
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </label>
                </div>

                {submitError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(PRIMARY_BUTTON, "w-full sm:w-auto")}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving your answers
                      </>
                    ) : (
                      <>
                        Show Me My Next Step <ArrowRight className="size-4" strokeWidth={2} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {submitError && step.kind !== "contact" && !finalKnownStep && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {submitError}
            </p>
          )}

          {stepIndex > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" strokeWidth={2} /> Back
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-[520px] text-center">
        <p className="text-[12.5px] font-semibold text-foreground">No pressure. Just clarity.</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Completing this assessment does not obligate you to purchase anything or schedule a call.
          Its purpose is simply to help determine whether CMDT is worth exploring further.
        </p>
      </div>
    </div>
  );
}

function ChoiceList({
  step,
  value,
  onChoose,
}: {
  step: ChoiceStep;
  value: string | undefined;
  onChoose: (key: ChoiceKey, value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={step.prompt} className="grid gap-2.5">
      {step.options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(step.key, option.value)}
            className={cn(
              "ownership-flow-option flex w-full items-center gap-3.5 rounded-control border bg-card px-4 py-3.5 text-left text-[14px] font-medium leading-snug text-foreground transition-colors",
              selected
                ? "border-sidebar bg-primary-soft ring-1 ring-sidebar/15"
                : "border-border hover:border-border-strong hover:bg-surface-raised",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-sidebar bg-sidebar" : "border-border-strong bg-card",
              )}
            >
              {selected && <span className="size-[7px] rounded-full bg-white" />}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CompletionScreen({
  completion,
  headingRef,
}: {
  completion: Completion;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const research = {
    key: "research",
    icon: Compass,
    title: "Explore CMDT at Your Own Pace",
    body: "Review the business model, owner responsibilities, investment information, training and support, territory considerations, FAQs, and next steps.",
    cta: "Open My CMDT Research Center",
    href: completion.portalUrl,
    external: false,
  };
  const talk = {
    key: "talk",
    icon: CalendarDays,
    title: "Ready to Talk It Through?",
    body: "If you already have enough information to know you want a conversation, you can choose a time with the CMDT team now.",
    cta: "Schedule a Conversation",
    href: completion.scheduleUrl ?? "",
    external: true,
  };
  // A strong fit leads with the conversation; everyone else leads with research.
  const cards = (completion.fit === "strong" ? [talk, research] : [research, talk]).filter(
    (card) => card.href,
  );

  return (
    <div className="ownership-profile-step" role="status">
      <header className="text-center">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-accent-gold">
          Your Next Step
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 scroll-mt-16 font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.01em] text-sidebar outline-none sm:text-[36px]"
        >
          Thanks, {completion.firstName}. Here’s What I’d Do Next.
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.6] text-muted-foreground">
          You’ve given us enough information to understand what you’re looking for.
        </p>
        <p className="mx-auto mt-2 max-w-[560px] text-[15px] leading-[1.6] text-muted-foreground">
          From here, you have two ways to continue.
        </p>
      </header>

      <div className={cn("mt-9 grid gap-4", cards.length > 1 && "sm:grid-cols-2")}>
        {cards.map((card, index) => {
          const primary = index === 0;
          return (
            <div
              key={card.key}
              className={cn(
                "flex flex-col rounded-card border bg-card p-6 shadow-card sm:p-7",
                primary ? "border-sidebar/50 ring-1 ring-sidebar/10" : "border-border",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border",
                  primary
                    ? "border-accent-gold bg-[#fbf7ef] text-sidebar"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <card.icon className="size-5" strokeWidth={1.6} />
              </span>
              <h3 className="mt-4 font-serif text-[22px] font-medium leading-[1.2] text-sidebar">
                {card.title}
              </h3>
              <p className="mt-2 flex-1 text-[14px] leading-[1.55] text-muted-foreground">
                {card.body}
              </p>
              <a
                href={card.href}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noopener noreferrer" : undefined}
                className={cn(primary ? PRIMARY_BUTTON : OUTLINE_BUTTON, "mt-6 w-full")}
              >
                {card.cta} <ArrowRight className="size-4" strokeWidth={2} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
