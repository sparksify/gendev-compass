"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Shared bridge-page state between the video and the assessment, which are
 * not siblings in one client tree (the page keeps its header, proof strip,
 * and footer as server components).
 *
 * - percent / started: how much of the video was watched, attached to an
 *   anonymous submission.
 * - token: the lead's portal token. Set from the start on /watch/[token];
 *   on the anonymous page it appears once the assessment creates the
 *   lead, after which the player reports to that lead's history too.
 */

interface BridgeVideoState {
  /** Unique percent of the video watched so far, 0–100. */
  percent: number;
  started: boolean;
  token: string | null;
}

interface BridgeVideoContextValue extends BridgeVideoState {
  report: (patch: Partial<BridgeVideoState>) => void;
}

const BridgeVideoContext = createContext<BridgeVideoContextValue>({
  percent: 0,
  started: false,
  token: null,
  report: () => undefined,
});

export function BridgeVideoProvider({
  children,
  initialToken = null,
}: {
  children: React.ReactNode;
  initialToken?: string | null;
}) {
  const [state, setState] = useState<BridgeVideoState>({
    percent: 0,
    started: false,
    token: initialToken,
  });
  const report = useCallback((patch: Partial<BridgeVideoState>) => {
    setState((prev) => {
      const next = {
        started: patch.started ?? prev.started,
        // Never lowers — a rewind is not "less watched".
        percent: Math.max(prev.percent, patch.percent ?? prev.percent),
        token: patch.token ?? prev.token,
      };
      return next.started === prev.started &&
        next.percent === prev.percent &&
        next.token === prev.token
        ? prev
        : next;
    });
  }, []);
  const value = useMemo(() => ({ ...state, report }), [state, report]);
  return <BridgeVideoContext.Provider value={value}>{children}</BridgeVideoContext.Provider>;
}

export function useBridgeVideo(): BridgeVideoContextValue {
  return useContext(BridgeVideoContext);
}
