import type { TerritoryAlternative, TerritoryEvaluationResult } from "@/types/territory";

export type ChatRole = "advisor" | "user";

export interface ChatMessageData {
  id: string;
  role: ChatRole;
  text?: string;
  result?: TerritoryEvaluationResult;
  alternatives?: TerritoryAlternative[];
  loadingLabel?: string;
  isError?: boolean;
}
