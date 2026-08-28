"use client";

import { useEffect, useState } from "react";
import { Kanban, List as ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvestorRow } from "@/lib/advisor/investors";
import { QuestionnaireListView } from "./QuestionnaireListView";
import { QuestionnaireBoardView } from "./QuestionnaireBoardView";

type View = "list" | "board";

const STORAGE_KEY = "advisor:questionnaires-view";

/**
 * List / Board toggle for the Questionnaires page. Starts on List (so the
 * server-rendered markup and the first client render always match) and
 * switches to whatever the advisor last picked once the client mounts —
 * a one-frame flash beats a hydration mismatch.
 */
export function QuestionnairesViewSwitcher({ rows }: { rows: InvestorRow[] }) {
  const [view, setView] = useState<View>("list");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "board") setView(saved);
  }, []);

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — the toggle still works for
      // this visit, it just won't be remembered next time.
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div
        role="tablist"
        aria-label="Questionnaires view"
        className="inline-flex w-fit items-center gap-0.5 rounded-control border border-border-strong bg-card p-0.5"
      >
        <ToggleButton active={view === "list"} onClick={() => choose("list")} icon={ListIcon}>
          List
        </ToggleButton>
        <ToggleButton active={view === "board"} onClick={() => choose("board")} icon={Kanban}>
          Board
        </ToggleButton>
      </div>

      {view === "list" ? <QuestionnaireListView rows={rows} /> : <QuestionnaireBoardView rows={rows} />}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ListIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-[7px] text-[12.5px] font-bold transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-surface hover:text-secondary-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
      {children}
    </button>
  );
}
