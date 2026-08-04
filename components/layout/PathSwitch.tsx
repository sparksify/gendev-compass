"use client";

import { usePathname } from "next/navigation";

interface PathSwitchProps {
  /** Rendered when the current pathname ends with this suffix. */
  suffix: string;
  match: React.ReactNode;
  otherwise: React.ReactNode;
}

/**
 * Swaps pre-rendered server content by route. Used by the shared right
 * sidebar to show page-specific cards without moving it out of the layout.
 */
export function PathSwitch({ suffix, match, otherwise }: PathSwitchProps) {
  const pathname = usePathname();
  return <>{pathname.endsWith(suffix) ? match : otherwise}</>;
}
