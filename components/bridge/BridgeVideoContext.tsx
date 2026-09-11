"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Lets the fit assessment read how much of the bridge video was watched
 * without the two components being siblings in one client tree — the
 * page keeps its header, proof strip, and footer as server components.
 */

interface BridgeVideoState {
  /** Unique percent of the video watched so far, 0–100. */
  percent: number;
  started: boolean;
}

interface BridgeVideoContextValue extends BridgeVideoState {
  report: (patch: Partial<BridgeVideoState>) => void;
}

const BridgeVideoContext = createContext<BridgeVideoContextValue>({
  percent: 0,
  started: false,
  report: () => undefined,
});

export function BridgeVideoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BridgeVideoState>({ percent: 0, started: false });
  const report = useCallback((patch: Partial<BridgeVideoState>) => {
    setState((prev) => {
      const next = {
        started: patch.started ?? prev.started,
        // Never lowers — a rewind is not "less watched".
        percent: Math.max(prev.percent, patch.percent ?? prev.percent),
      };
      return next.started === prev.started && next.percent === prev.percent ? prev : next;
    });
  }, []);
  const value = useMemo(() => ({ ...state, report }), [state, report]);
  return <BridgeVideoContext.Provider value={value}>{children}</BridgeVideoContext.Provider>;
}

export function useBridgeVideo(): BridgeVideoContextValue {
  return useContext(BridgeVideoContext);
}
