"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "gendev-ownership-profile-due-diligence";

function storageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId}`;
}

function readSaved(scopeId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scopeId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * "Add to My Due Diligence" — V1 keeps the selected question ids on this
 * device only (no due diligence workspace exists yet). Kept separate from
 * useOwnershipProfileStorage so the versioned profile record stays
 * untouched; a future workspace can migrate this list server-side.
 */
export function useSavedDueDiligenceQuestions(scopeId: string) {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    setSaved(readSaved(scopeId));
  }, [scopeId]);

  const toggle = useCallback(
    (questionId: string) => {
      setSaved((current) => {
        const next = current.includes(questionId)
          ? current.filter((id) => id !== questionId)
          : [...current, questionId];
        try {
          window.localStorage.setItem(storageKey(scopeId), JSON.stringify(next));
        } catch {
          // Private browsing / storage full — in-memory state still works.
        }
        return next;
      });
    },
    [scopeId],
  );

  return { saved, toggle };
}
