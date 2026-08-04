import { brand } from "@/lib/config/brand";

/**
 * Public root. Prospects only ever arrive via their personal /p/[token]
 * link, so this page is a minimal placeholder with no marketing content.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {brand.brandName}
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-foreground">{brand.portalLabel}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Access to this portal is by personal invitation. Please use the private link sent to you,
        or contact{" "}
        <a className="underline" href={`mailto:${brand.supportEmail}`}>
          {brand.supportEmail}
        </a>{" "}
        for assistance.
      </p>
    </main>
  );
}
