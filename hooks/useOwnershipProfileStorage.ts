"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_OWNERSHIP_PROFILE,
  type OwnershipProfileInput,
  type OwnershipProfileRecord,
} from "@/types/ownershipProfile";

const STORAGE_PREFIX = "gendev-ownership-profile";

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

function readRecord(scopeId: string): OwnershipProfileRecord {
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

/**
 * Local-only persistence for the Ownership Profile (no database, no API —
 * see the feature spec). Scoped per-investor by portal token so two
 * different portal links on the same device never collide.
 *
 * Deliberately mirrors the shape a future server-backed version would use
 * (`OwnershipProfileRecord`) so swapping this hook's internals for an API
 * call later is a drop-in change — nothing that reads `profile` needs to
 * know where it came from.
 */
export function useOwnershipProfileStorage(scopeId: string) {
  const [record, setRecord] = useState<OwnershipProfileRecord>(defaultRecord());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Re-hydrates if the scope (portal token) ever changes on this page.
    setRecord(readRecord(scopeId));
    setHydrated(true);
  }, [scopeId]);

  const persist = useCallback(
    (next: OwnershipProfileRecord) => {
      setRecord(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey(scopeId), JSON.stringify(next));
      } catch {
        // Private-browsing / storage-full: the in-memory state still works
        // for this session, it just won't survive a reload.
      }
    },
    [scopeId],
  );

  const updateProfile = useCallback(
    (patch: Partial<OwnershipProfileInput>) => {
      persist({
        ...record,
        ...patch,
        version: 1,
        updatedAt: new Date().toISOString(),
      });
    },
    [record, persist],
  );

  const setCurrentStep = useCallback(
    (step: number) => {
      persist({ ...record, currentStep: step, updatedAt: new Date().toISOString() });
    },
    [record, persist],
  );

  const markCompleted = useCallback(() => {
    persist({ ...record, completedAt: new Date().toISOString() });
  }, [record, persist]);

  /** Returns to the wizard from the summary, keeping existing answers. */
  const beginEditing = useCallback(
    (step = 0) => {
      persist({ ...record, completedAt: null, currentStep: step, updatedAt: new Date().toISOString() });
    },
    [record, persist],
  );

  const reset = useCallback(() => {
    persist(defaultRecord());
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
