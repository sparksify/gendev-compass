import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "./statusMeta";
import { AlternativesList } from "./AlternativesList";
import { ctaForStatus, type CtaAction } from "./cta";
import type { ChatMessageData } from "./types";
import type { TerritoryAlternative } from "@/types/territory";

interface ChatMessageProps {
  message: ChatMessageData;
  onAction: (action: CtaAction) => void;
  onSelectCandidate?: (candidate: { label: string; city: string; stateCode: string; zipCode: string }) => void;
  onSelectAlternative: (alternative: TerritoryAlternative) => void;
  disabled?: boolean;
  /** Suppress the per-status CTA buttons (the workspace renders smart chips
   *  and the advisor follow-up for the latest result instead). */
  hideCtas?: boolean;
}

export function ChatMessage({
  message,
  onAction,
  onSelectCandidate,
  onSelectAlternative,
  disabled,
  hideCtas,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  if (message.loadingLabel) {
    return (
      <div className="flex items-center gap-2.5 rounded-control bg-surface px-3.5 py-2.5 text-[13px] text-muted-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        {message.loadingLabel}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-control bg-primary-soft px-3.5 py-2.5 text-[13.5px] text-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const cta = message.result && !hideCtas ? ctaForStatus(message.result.status) : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`max-w-[92%] rounded-control border px-3.5 py-3 text-[13.5px] leading-relaxed ${
          message.isError
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : "border-border-soft bg-surface text-foreground"
        }`}
      >
        {message.text}

        {message.result && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Badge className={STATUS_META[message.result.status].badgeClass}>
              {(() => {
                const Icon = STATUS_META[message.result.status].icon;
                return <Icon className="size-3" strokeWidth={2} />;
              })()}
              {STATUS_META[message.result.status].label}
            </Badge>
          </div>
        )}

        {message.result?.candidates && message.result.candidates.length > 1 && onSelectCandidate && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.result.candidates.map((c) => (
              <button
                key={`${c.city}-${c.stateCode}-${c.zipCode}`}
                type="button"
                disabled={disabled}
                onClick={() => onSelectCandidate(c)}
                className="rounded-full border border-primary-soft-border bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {message.alternatives && (
          <AlternativesList
            alternatives={message.alternatives}
            onSelect={onSelectAlternative}
            disabled={disabled}
          />
        )}
      </div>

      {cta && (cta.primary || cta.secondary) && (
        <div className="flex flex-wrap gap-2 pl-1">
          {cta.primary && (
            <Button type="button" size="sm" disabled={disabled} onClick={() => onAction(cta.primary!.action)}>
              {cta.primary.label} <ArrowRight className="size-3.5" />
            </Button>
          )}
          {cta.secondary && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onAction(cta.secondary!.action)}
            >
              {cta.secondary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
