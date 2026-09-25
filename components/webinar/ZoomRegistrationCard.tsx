import { ExternalLink, Video } from "lucide-react";

export function ZoomRegistrationCard({ fallbackUrl }: { fallbackUrl: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-10">
      <Video className="mx-auto size-12 text-[#2D8CFF]" aria-hidden="true" />
      <h2 className="mt-4 font-serif text-2xl text-sidebar">Choose your live Zoom overview</h2>
      <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
        Zoom will open its secure registration page so you can choose a date, complete the bot check, and register for the session.
      </p>
      <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-[#2D8CFF] px-8 text-base font-semibold text-white shadow-sm hover:bg-[#2681e5]">
        Open Zoom registration <ExternalLink className="size-5" aria-hidden="true" />
      </a>
      <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
        After you submit the Zoom form, Zoom will show its confirmation and email your personal link. Compass will record the registration automatically.
      </p>
    </div>
  );
}
