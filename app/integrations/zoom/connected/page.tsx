import { CheckCircle2, CircleAlert } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zoom Connection | GenDev Compass", robots: { index: false } };

export default async function ZoomConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const status = (await searchParams).status;
  const success = status === "success";
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 text-foreground">
      <section className="w-full max-w-lg rounded-card border border-border bg-card p-8 text-center shadow-card">
        {success ? (
          <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        ) : (
          <CircleAlert className="mx-auto size-12 text-destructive" aria-hidden="true" />
        )}
        <h1 className="mt-4 font-serif text-3xl text-sidebar">
          {success ? "Zoom is connected" : "Zoom was not connected"}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {success
            ? "Compass can now register prospects for the CMDT live overview. You may close this window."
            : status === "denied"
              ? "Authorization was cancelled. Return to Zoom and approve the requested meeting permissions."
              : "The connection could not be saved. Return to the Zoom app setup and try again after checking the credentials."}
        </p>
      </section>
    </main>
  );
}
