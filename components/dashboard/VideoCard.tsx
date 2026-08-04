import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
}

/** The Investor Overview player with live, server-tracked watch progress. */
export function VideoCard({
  token,
  state,
  videoProgress,
  mediaId,
  completionThreshold,
  showDevTools,
}: VideoCardProps) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeader
          number={1}
          title="Investor Overview"
          description="Watch the complete overview to unlock your qualification questionnaire."
        />

        <WistiaPlayer
          mediaId={mediaId}
          token={token}
          initialPercent={state.videoPercent}
          initialCompleted={state.videoCompleted}
          resumePosition={videoProgress?.last_playhead_position ?? 0}
          completionThreshold={completionThreshold}
        />

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Estimated viewing time: {VIDEO_ESTIMATED_MINUTES} minutes
        </p>

        {showDevTools && <DevToolsPanel token={token} />}
      </CardContent>
    </Card>
  );
}
