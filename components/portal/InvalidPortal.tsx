import { brand } from "@/lib/config/brand";

export function InvalidPortal() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <h1 className="font-serif text-2xl font-semibold text-foreground">
        This portal link is invalid or has expired.
      </h1>
      <p className="mt-3 text-muted-foreground">Please contact our team for assistance.</p>
      <a
        href={`mailto:${brand.supportEmail}`}
        className="mt-6 inline-block rounded-control bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Contact Support
      </a>
    </div>
  );
}
