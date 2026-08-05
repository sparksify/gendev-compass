import {
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  HelpCircle,
  Lock,
  MapPinOff,
  Settings,
} from "lucide-react";
import type { TerritoryResultStatus } from "@/types/territory";

export interface StatusMeta {
  label: string;
  icon: typeof CheckCircle2;
  badgeClass: string;
  mapClass: string;
}

/**
 * Visual language for each structured result status — shared by the chat
 * result card, the market summary card, and the map pin. Color is always
 * paired with a label and an icon, never used alone (per spec's
 * accessibility requirement).
 */
export const STATUS_META: Record<TerritoryResultStatus, StatusMeta> = {
  AVAILABLE: {
    label: "Appears Available",
    icon: CheckCircle2,
    badgeClass: "bg-success-soft text-success",
    mapClass: "fill-success/15 stroke-success text-success",
  },
  PARTIALLY_AVAILABLE: {
    label: "Limited Availability",
    icon: CircleAlert,
    badgeClass: "bg-[#fef3c7] text-[#92400e]",
    mapClass: "fill-[#f59e0b]/15 stroke-[#d97706] text-[#92400e]",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    icon: CircleSlash,
    badgeClass: "bg-destructive/10 text-destructive",
    mapClass: "fill-destructive/15 stroke-destructive text-destructive",
  },
  STATE_RESTRICTED: {
    label: "Not Currently Available",
    icon: Lock,
    badgeClass: "bg-surface text-muted-foreground",
    mapClass: "fill-muted-foreground/10 stroke-muted-foreground text-muted-foreground",
  },
  MANUAL_REVIEW: {
    label: "Manual Review Needed",
    icon: Settings,
    badgeClass: "bg-primary-soft text-primary",
    mapClass: "fill-primary/15 stroke-primary text-primary",
  },
  LOCATION_NOT_FOUND: {
    label: "Location Not Found",
    icon: MapPinOff,
    badgeClass: "bg-surface text-muted-foreground",
    mapClass: "fill-muted-foreground/10 stroke-muted-foreground text-muted-foreground",
  },
  BRAND_NOT_CONFIGURED: {
    label: "Not Set Up Yet",
    icon: HelpCircle,
    badgeClass: "bg-surface text-muted-foreground",
    mapClass: "fill-muted-foreground/10 stroke-muted-foreground text-muted-foreground",
  },
};
