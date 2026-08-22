"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOwnershipProfileStorage } from "@/hooks/useOwnershipProfileStorage";
import {
  BinaryChoice,
  OptionGrid,
  ScreenShell,
  SliderScreenBody,
} from "@/components/portal/ownership-profile/FlowScreens";
import { ProfileSummary } from "@/components/portal/ownership-profile/ProfileSummary";
import {
  ACTIVITY_OPTIONS,
  ACTIVITY_SELECTION_LIMIT,
  ENVIRONMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GROWTH_COMFORT_OPTIONS,
  MOTIVATION_OPTIONS,
  PRIORITY_OPTIONS,
  PRIORITY_SELECTION_LIMIT,
  TIMELINE_OPTIONS,
  type MotivationValue,
  type OwnershipProfileInput,
} from "@/types/ownershipProfile";

/**
 * One-question-at-a-time flow (Typeform-style): each screen is a single
 * decision — a yes/no card, a tap-one select, a pick-N grid, or the style
 * slider — and answering advances automatically wherever the answer is
 * unambiguous. The goal is pace: the investor should feel like they're
 * having a quick exchange, not filling out a form.
 *
 * Data contract is unchanged from the sectioned wizard: the same
 * OwnershipProfileInput fields, the same server schema. `currentStep`
 * still records the parent *section* (0–8, validated server-side); the
 * finer-grained screen position is a UI convenience kept in its own
 * localStorage key.
 */

/** Advance delay after a tap — long enough to see the selection register. */
const ADVANCE_MS = 280;

type ListField = "motivations" | "activities" | "environments" | "priorities" | "experience";

type Screen =
  | {
      kind: "binary";
      section: number;
      eyebrow: string;
      prompt: string;
      value: MotivationValue;
    }
  | {
      kind: "pickN";
      section: number;
      eyebrow: string;
      prompt: string;
      helper: string;
      field: ListField;
      options: ReadonlyArray<{ value: string; label: string }>;
      max: number;
    }
  | {
      kind: "multi";
      section: number;
      eyebrow: string;
      prompt: string;
      helper: string;
      field: ListField;
      options: ReadonlyArray<{ value: string; label: string }>;
    }
  | {
      kind: "single";
      section: number;
      eyebrow: string;
      prompt: string;
      field: "growthComfort" | "timeline";
      options: ReadonlyArray<{ value: string; label: string }>;
    }
  | { kind: "slider"; section: number; eyebrow: string; prompt: string };

const MOTIVATION_COUNT = MOTIVATION_OPTIONS.length;

const FLOW: Screen[] = [
  // Rapid-fire round: one motivation per screen, pure yes/no.
  ...MOTIVATION_OPTIONS.map((option, index) => ({
    kind: "binary" as const,
    section: 0,
    eyebrow: `What's driving you · ${index + 1} of ${MOTIVATION_COUNT}`,
    prompt: option.label,
    value: option.value,
  })),
  {
    kind: "pickN",
    section: 1,
    eyebrow: "Your working style",
    prompt: "Pick the three activities you'd enjoy most.",
    helper: "Tap three — we'll move on automatically.",
    field: "activities",
    options: ACTIVITY_OPTIONS,
    max: ACTIVITY_SELECTION_LIMIT,
  },
  {
    kind: "slider",
    section: 2,
    eyebrow: "Your ownership style",
    prompt: "How involved do you want to be day-to-day?",
  },
  {
    kind: "single",
    section: 3,
    eyebrow: "Your ambition",
    prompt: "How big do you want this to get?",
    field: "growthComfort",
    options: GROWTH_COMFORT_OPTIONS,
  },
  {
    kind: "multi",
    section: 4,
    eyebrow: "Your world",
    prompt: "Which industries catch your eye?",
    helper: "Tap any that interest you, then continue.",
    field: "environments",
    options: ENVIRONMENT_OPTIONS,
  },
  {
    kind: "pickN",
    section: 5,
    eyebrow: "What matters most",
    prompt: "Pick up to five things a business must have.",
    helper: "Choose up to five — we'll advance when you hit five.",
    field: "priorities",
    options: PRIORITY_OPTIONS,
    max: PRIORITY_SELECTION_LIMIT,
  },
  {
    kind: "multi",
    section: 6,
    eyebrow: "Your background",
    prompt: "Where have you spent your career so far?",
    helper: "Tap everything that applies, then continue.",
    field: "experience",
    options: EXPERIENCE_OPTIONS,
  },
  {
    kind: "single",
    section: 7,
    eyebrow: "Last one",
    prompt: "When are you looking to make a move?",
    field: "timeline",
    options: TIMELINE_OPTIONS,
  },
];

/** Section recorded once the flow is finished (schema max — see validation). */
const DONE_SECTION = 8;

/** Milestone encouragements, shown when the investor reaches that screen. */
const CHEERS: Record<number, string> = {
  [MOTIVATION_COUNT]: "Quick-fire round done — nice pace.",
  [MOTIVATION_COUNT + 4]: "Over halfway there.",
  [FLOW.length - 1]: "Last question.",
};

function positionKey(scopeId: string): string {
  return `gendev-ownership-profile-pos:${scopeId}`;
}

function readPosition(scopeId: string): number | null {
  try {
    const raw = window.localStorage.getItem(positionKey(scopeId));
    if (raw === null) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writePosition(scopeId: string, pos: number): void {
  try {
    window.localStorage.setItem(positionKey(scopeId), String(pos));
  } catch {
    // Private browsing — resume falls back to the section from the record.
  }
}

/** First screen belonging to a section (used to resume from the record). */
function firstScreenOfSection(section: number): number {
  const index = FLOW.findIndex((screen) => screen.section === section);
  return index === -1 ? FLOW.length : index;
}

interface OwnershipProfileAssessmentProps {
  /** Scopes local persistence to this investor's portal link. */
  token: string;
  /** The brand under evaluation, from portal context (null if unresolved). */
  brandName: string | null;
}

export function OwnershipProfileAssessment({ token, brandName }: OwnershipProfileAssessmentProps) {
  const {
    profile,
    hydrated,
    updateProfile,
    setCurrentStep,
    markCompleted,
    beginEditing,
    isComplete,
  } = useOwnershipProfileStorage(token);

  /** Screen index within FLOW; FLOW.length = the summary/report. */
  const [pos, setPos] = useState(0);
  const [positioned, setPositioned] = useState(false);
  /** Locks input during the brief post-answer advance animation. */
  const [advancing, setAdvancing] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);

  // Resume: whichever is further of the saved screen position and the
  // record's section (the record may be newer — e.g. finished on a laptop).
  useEffect(() => {
    if (!hydrated || positioned) return;
    const fromRecord = firstScreenOfSection(profile.currentStep);
    const fromLocal = readPosition(token) ?? 0;
    setPos(Math.min(Math.max(fromLocal, fromRecord, 0), FLOW.length));
    setPositioned(true);
  }, [hydrated, positioned, profile.currentStep, token]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Land keyboard/screen-reader focus on each new question.
  useEffect(() => {
    if (positioned && pos < FLOW.length) promptRef.current?.focus();
  }, [pos, positioned]);

  const goTo = useCallback(
    (next: number, withDelay = false) => {
      const target = Math.min(Math.max(next, 0), FLOW.length);
      const commit = () => {
        setAdvancing(false);
        setPos(target);
        writePosition(token, target);
        const section = target >= FLOW.length ? DONE_SECTION : FLOW[target].section;
        if (section !== profile.currentStep) setCurrentStep(section);
      };
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (withDelay) {
        setAdvancing(true);
        advanceTimer.current = setTimeout(commit, ADVANCE_MS);
      } else {
        commit();
      }
    },
    [token, profile.currentStep, setCurrentStep],
  );

  const screen = pos < FLOW.length ? FLOW[pos] : null;

  const toggleListValue = useCallback(
    (field: ListField, value: string, max?: number) => {
      const current = profile[field] as string[];
      if (current.includes(value)) {
        updateProfile({ [field]: current.filter((item) => item !== value) });
        return;
      }
      if (typeof max === "number" && current.length >= max) return;
      const next = [...current, value];
      updateProfile({ [field]: next });
      // Hitting the cap is the "done" signal on pick-N screens.
      if (typeof max === "number" && next.length >= max) goTo(pos + 1, true);
    },
    [profile, updateProfile, goTo, pos],
  );

  const answerBinary = useCallback(
    (value: MotivationValue, yes: boolean) => {
      const current = profile.motivations;
      const has = current.includes(value);
      if (yes && !has) updateProfile({ motivations: [...current, value] });
      if (!yes && has) updateProfile({ motivations: current.filter((item) => item !== value) });
      goTo(pos + 1, true);
    },
    [profile.motivations, updateProfile, goTo, pos],
  );

  const answerSingle = useCallback(
    (field: "growthComfort" | "timeline", value: string) => {
      updateProfile({ [field]: value } as Partial<OwnershipProfileInput>);
      goTo(pos + 1, true);
    },
    [updateProfile, goTo, pos],
  );

  // Keyboard shortcuts: Y/N on binary screens, 1–9 to tap options, Enter to
  // continue where a continue button exists. Skipped while a form control
  // (e.g. the slider) has focus, so arrow keys keep working there.
  useEffect(() => {
    if (!screen || advancing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.getAttribute("role") === "slider") return;

      const key = event.key.toLowerCase();
      if (screen.kind === "binary") {
        if (key === "y") answerBinary(screen.value, true);
        if (key === "n") answerBinary(screen.value, false);
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const index = Number.parseInt(key, 10) - 1;
        if (screen.kind === "single" && screen.options[index]) {
          answerSingle(screen.field, screen.options[index].value);
        }
        if ((screen.kind === "pickN" || screen.kind === "multi") && screen.options[index]) {
          toggleListValue(
            screen.field,
            screen.options[index].value,
            screen.kind === "pickN" ? screen.max : undefined,
          );
        }
        return;
      }
      if (key === "enter" && (screen.kind === "multi" || screen.kind === "pickN")) {
        goTo(pos + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, advancing, answerBinary, answerSingle, toggleListValue, goTo, pos]);

  if (!hydrated || !positioned) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="h-[7px] w-full animate-pulse rounded-full bg-[#e9edf2]" />
          <div className="mx-auto mt-12 h-7 w-2/3 animate-pulse rounded bg-[#e9edf2]" />
          <div className="mx-auto mt-6 h-32 w-full max-w-[540px] animate-pulse rounded bg-[#f2f4f7]" />
        </CardContent>
      </Card>
    );
  }

  if (isComplete || pos >= FLOW.length) {
    return (
      <Card>
        <CardContent className="ownership-profile-step p-6 sm:p-8">
          <ProfileSummary
            profile={profile}
            isSaved={isComplete}
            onSave={markCompleted}
            onEdit={() => {
              beginEditing(0);
              writePosition(token, 0);
              setPos(0);
            }}
            token={token}
            brandName={brandName}
          />
        </CardContent>
      </Card>
    );
  }

  const current = FLOW[pos];
  const progressValue = (pos / FLOW.length) * 100;
  const cheer = CHEERS[pos];

  const listSelected =
    current.kind === "pickN" || current.kind === "multi"
      ? (profile[current.field] as string[])
      : [];

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 text-[12px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {pos + 1} of {FLOW.length}
            </span>
            {cheer && (
              <span className="ml-2 font-medium text-success" aria-live="polite">
                {cheer}
              </span>
            )}
          </span>
          <span>{Math.round(progressValue)}%</span>
        </div>
        <Progress value={progressValue} className="mt-2" aria-label="Ownership Profile progress" />

        <div
          key={pos}
          className="ownership-profile-step flex min-h-[380px] flex-col justify-center py-8 sm:py-10"
        >
          {current.kind === "binary" && (
            <ScreenShell
              eyebrow={current.eyebrow}
              prompt={current.prompt}
              helper="Is this part of what you're looking for?"
              promptRef={promptRef}
            >
              <BinaryChoice
                value={
                  advancing || profile.motivations.includes(current.value)
                    ? profile.motivations.includes(current.value)
                    : undefined
                }
                onAnswer={(yes) => answerBinary(current.value, yes)}
                disabled={advancing}
              />
            </ScreenShell>
          )}

          {current.kind === "pickN" && (
            <ScreenShell
              eyebrow={current.eyebrow}
              prompt={current.prompt}
              helper={current.helper}
              promptRef={promptRef}
            >
              <OptionGrid
                options={current.options}
                selected={listSelected}
                onToggle={(value) => toggleListValue(current.field, value, current.max)}
                max={current.max}
                disabled={advancing}
              />
              <div className="mt-5 flex items-center justify-center gap-4">
                <span className="text-[12px] font-medium text-muted-foreground" aria-live="polite">
                  {listSelected.length} of {current.max} picked
                </span>
                {listSelected.length > 0 && listSelected.length < current.max && (
                  <Button type="button" variant="outline" size="sm" onClick={() => goTo(pos + 1)}>
                    That&rsquo;s enough — continue
                  </Button>
                )}
              </div>
            </ScreenShell>
          )}

          {current.kind === "multi" && (
            <ScreenShell
              eyebrow={current.eyebrow}
              prompt={current.prompt}
              helper={current.helper}
              promptRef={promptRef}
            >
              <OptionGrid
                options={current.options}
                selected={listSelected}
                onToggle={(value) => toggleListValue(current.field, value)}
                disabled={advancing}
              />
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button type="button" size="lg" onClick={() => goTo(pos + 1)}>
                  Continue
                </Button>
                {listSelected.length === 0 && (
                  <button
                    type="button"
                    onClick={() => goTo(pos + 1)}
                    className="text-[12.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </ScreenShell>
          )}

          {current.kind === "single" && (
            <ScreenShell eyebrow={current.eyebrow} prompt={current.prompt} promptRef={promptRef}>
              <OptionGrid
                options={current.options}
                selected={
                  profile[current.field] === null ? [] : [profile[current.field] as string]
                }
                onToggle={(value) => answerSingle(current.field, value)}
                disabled={advancing}
              />
            </ScreenShell>
          )}

          {current.kind === "slider" && (
            <ScreenShell
              eyebrow={current.eyebrow}
              prompt={current.prompt}
              helper="Slide toward the role you actually want."
              promptRef={promptRef}
            >
              <SliderScreenBody
                value={profile.ownershipStyle}
                onChange={(value) => updateProfile({ ownershipStyle: value })}
                onConfirm={() => goTo(pos + 1)}
              />
            </ScreenShell>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goTo(pos - 1)}
            disabled={pos === 0 || advancing}
            aria-label="Previous question"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Back
          </Button>
          <span className="text-[11px] text-faint-foreground">
            Answers save automatically
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
