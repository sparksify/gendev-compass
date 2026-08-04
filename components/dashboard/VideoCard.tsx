import Image from "next/image";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { WistiaPlayer } from "@/components/portal/WistiaPlayer";
import { DevToolsPanel } from "@/components/portal/DevToolsPanel";
import { VIDEO_ESTIMATED_MINUTES } from "@/lib/config/content";
import type { PortalState } from "@/types/portal";
import type { VideoProgressRecord } from "@/types/portal";

interface VideoCardProps {
  token: string;
  state: PortalState;
  videoProgress: VideoProgressRecord | null;
  mediaId: string | null;
  completionThreshold: number;
  showDevTools: boolean;
  /** Featured brand's logo, shown at the right of the card header. */
  brandLogo?: { src: string; alt: string };
}

/** The Investor Overview player with live, server-tracked watch progress. */
export function VideoCard({
  token,
  state,
  videoProgress,
  mediaId,
  completionThreshold,
  showDevTools,
  brandLogo,
}: VideoCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-[18px]">
        <SectionHeader number={1} title="Investor Overview" />
        {brandLogo && (
          <Image
            src={brandLogo.src}
            alt={brandLogo.alt}
            width={132}
            height={40}
            className="h-8 w-auto shrink-0"
          />
        )}
      </div>

      <div className="px-5">
        <WistiaPlayer
          mediaId={mediaId}
          token={token}
          initialPercent={state.videoPercent}
          initialCompleted={state.videoCompleted}
          resumePosition={videoProgress?.last_playhead_position ?? 0}
          completionThreshold={completionThreshold}
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-5 pb-[18px] pt-3.5">
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Clock className="size-[15px] text-faint-foreground" strokeWidth={1.7} />
          Estimated viewing time:{" "}
          <span className="font-medium text-foreground">{VIDEO_ESTIMATED_MINUTES} Minutes</span>
        </p>
      </div>

      {showDevTools && (
        <div className="px-5 pb-5">
          <DevToolsPanel token={token} />
        </div>
      )}
    </Card>
  );
}
