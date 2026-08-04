import { brand } from "@/lib/config/brand";

export function PortalFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          <a href={brand.privacyPolicyUrl} className="hover:text-ink hover:underline">
            Privacy Policy
          </a>
          <a href={brand.termsUrl} className="hover:text-ink hover:underline">
            Terms
          </a>
          <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink hover:underline">
            {brand.supportEmail}
          </a>
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">{brand.legalDisclaimer}</p>
        <p className="text-xs text-ink-muted">
          © {new Date().getFullYear()} {brand.brandName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
