import { brand } from "@/lib/config/brand";

export function InvalidPortal() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <h1 className="text-xl font-semibold text-ink">This portal link is invalid or has expired.</h1>
      <p className="mt-3 text-ink-muted">Please contact our team for assistance.</p>
      <a
        href={`mailto:${brand.supportEmail}`}
        className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Contact Support
      </a>
    </div>
  );
}
