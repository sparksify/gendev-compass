import {
  Briefcase,
  Factory,
  HardHat,
  Home,
  Landmark,
  Layers,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OpportunityIconKey } from "@/lib/config/opportunity";

/**
 * String-keyed icon registry so opportunity profiles stay serializable
 * (Supabase rows reference icons by name, never by component).
 */
export const OPPORTUNITY_ICONS: Record<OpportunityIconKey, LucideIcon> = {
  "shield-check": ShieldCheck,
  truck: Truck,
  layers: Layers,
  refresh: RefreshCw,
  "hard-hat": HardHat,
  factory: Factory,
  stethoscope: Stethoscope,
  landmark: Landmark,
  briefcase: Briefcase,
  users: Users,
  home: Home,
};
