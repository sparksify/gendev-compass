"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_OWNERSHIP_PROFILE,
  toOwnershipProfileInput,
  type OwnershipProfileDbRecord,
  type OwnershipProfileInput,
  type OwnershipProfileRecord,
} from "@/types/ownershipProfile";

const STORAGE_PREFIX = "gendev-ownership-profile";

/**
 * Delay before an edit is pushed to the server. The ownership-style slider
 * emits a change per pixel of drag, so writing on every change would mean
 * hundreds of requests for one answer.
 */
const AUTOSAVE_DEBOUNCE_MS = 1500;

function storageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId}`;
}

function defaultRecord(): OwnershipProfileRecord {
  return {
    ...EMPTY_OWNERSHIP_PROFILE,
    version: 1,
    currentStep: 0,
    updatedAt: new Date(0).toISOString(),
    completedAt: null,
  };
}

function readLocal(scopeId: string): OwnershipProfileRecord {
  if (typeof window === "undefined") return defaultRecord();
  try {
    const raw = window.localStorage.getItem(storageKey(scopeId));
    if (!raw) return defaultRecord();
    const parsed = JSON.parse(raw) as Partial<OwnershipProfileRecord>;
    if (parsed.version !== 1) return defaultRecord();
    return { ...defaultRecord(), ...parsed };
  } catch {
    return defaultRecord();
  }
}

function fromServer(row: OwnershipProfileDbRecord): OwnershipProfileRecord {
  return {
    ...toOwnershipProfileInput(row),
    version: 1,
    currentStep: row.current_step,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/**
 * Ownership Profile persistence: server-backed, with localStorage in front
 * of it.
 *
 * The server (ownership_profiles, via /api/portal/[token]/ownership-profile)
 * is the record of truth — it is what the advisor dashboard reads and what
 * the completion notification is built from. localStorage remains as the
 * immediate write, so answers survive a dropped connection, a closed tab
 * before the debounce fires, or a failed request, and the UI never waits on
 * the network to feel responsive.
 *
 * On mount the two are reconciled by `updatedAt`, newest wins. That is what
 * lets an investor start on their phone and finish on a laptop; it is a
 * last-write-wins merge, which is appropriate for a single-user form and
 * would not be for concurrent editing.
 *
 * The public shape is unchanged from the localStorage-only version, so
 * nothing that consumes this hook needed to change.
 */
export function useOwnershipProfileStorage(scopeId: string) {
  const [record, setRecord] = useState<OwnershipProfileRecord>(defaultRecord());
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest state, so a flush-on-unmount sends the newest answers. */
  const latest = useRef<OwnershipProfileRecord>(defaultRecord());

  const push = useCallback(
    async (next: OwnershipProfileRecord) => {
      try {
        await fetch(`/api/portal/${encodeURIComponent(scopeId)}/ownership-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            motivations: next.motivations,
            activities: next.activities,
            ownershipStyle: next.ownershipStyle,
            growthComfort: next.growthComfort,
            environments: next.environments,
            priorities: next.priorities,
            experience: next.experience,
            timeline: next.timeline,
            currentStep: next.currentStep,
            // The server decides whether this is a *new* completion.
            completed: next.completedAt !== null,
          }),
          keepalive: true,
        });
      } catch {
        // Offline or interrupted: localStorage still holds the answers and
        // the next edit (or the next visit) re-sends them.
      }
    },
    [scopeId],
  );

  // Hydrate: prefer whichever copy is newer, then reconcile the other.
  useEffect(() => {
    let cancelled = false;
    const local = readLocal(scopeId);
    setRecord(local);
    latest.current = local;

    (async () => {
      let remote: OwnershipProfileRecord | null = null;
      try {
        const response = await fetch(
          `/api/portal/${encodeURIComponent(scopeId)}/ownership-profile`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const data = (await response.json()) as {
            success: boolean;
            profile: OwnershipProfileDbRecord | null;
          };
          if (data.success && data.profile) remote = fromServer(data.profile);
        }
      } catch {
        // Server unreachable — carry on with the local copy.
      }
      if (cancelled) return;

      if (remote && remote.updatedAt > local.updatedAt) {
        setRecord(remote);
        latest.current = remote;
        try {
          window.localStorage.setItem(storageKey(scopeId), JSON.stringify(remote));
        } catch {
          // Private browsing; in-memory state is still correct.
        }
      } else if (local.updatedAt > new Date(0).toISOString()) {
        // Local is ahead (or the server has nothing) — publish it.
        void push(local);
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeId, push]);

  // Flush a pending autosave if the component goes away first.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        void push(latest.current);
      }
    };
  }, [push]);

  const persist = useCallback(
    (next: OwnershipProfileRecord, immediate = false) => {
      setRecord(next);
      latest.current = next;

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey(scopeId), JSON.stringify(next));
        } catch {
          // Private-browsing / storage-full: the in-memory state still works
          // for this session, it just won't survive a reload.
        }
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (immediate) {
        void push(next);
        return;
      }
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void push(next);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [scopeId, push],
  );

  const updateProfile = useCallback(
    (patch: Partial<OwnershipProfileInput>) => {
      persist({
        ...latest.current,
        ...patch,
        version: 1,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist],
  );

  const setCurrentStep = useCallback(
    (step: number) => {
      persist({ ...latest.current, currentStep: step, updatedAt: new Date().toISOString() });
    },
    [persist],
  );

  /** Completion notifies an advisor, so it is written through immediately. */
  const markCompleted = useCallback(() => {
    persist({ ...latest.current, completedAt: new Date().toISOString() }, true);
  }, [persist]);

  /** Returns to the wizard from the summary, keeping existing answers. */
  const beginEditing = useCallback(
    (step = 0) => {
      persist({
        ...latest.current,
        completedAt: null,
        currentStep: step,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    persist({ ...defaultRecord(), updatedAt: new Date().toISOString() }, true);
  }, [persist]);

  const isComplete = record.completedAt !== null;

  return useMemo(
    () => ({
      profile: record,
      hydrated,
      updateProfile,
      setCurrentStep,
      markCompleted,
      beginEditing,
      reset,
      isComplete,
    }),
    [record, hydrated, updateProfile, setCurrentStep, markCompleted, beginEditing, reset, isComplete],
  );
}
