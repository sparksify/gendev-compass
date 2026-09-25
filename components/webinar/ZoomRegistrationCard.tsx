import { ExternalLink, Video } from "lucide-react";

export function ZoomRegistrationCard({ fallbackUrl }: { fallbackUrl: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4 text-sidebar">
        <Video className="size-5 shrink-0 text-[#2D8CFF]" aria-hidden="true" />
        <div>
          <h2 className="font-serif text-xl">Register for the live Zoom overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose your session and complete Zoom’s registration form below.</p>
        </div>
      </div>

      <iframe
        title="Zoom registration"
        src={fallbackUrl}
        className="h-[1100px] w-full rounded-md border border-border bg-white sm:h-[980px]"
        loading="eager"
        allow="camera; microphone; fullscreen"
      />

      <p className="mt-4 text-center text-sm text-muted-foreground">
        If the registration form does not appear, open it directly in Zoom.
      </p>
      <div className="text-center">
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#2D8CFF] px-4 text-sm font-semibold text-[#2D8CFF] hover:bg-[#2D8CFF]/5">
          Open Zoom registration <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
