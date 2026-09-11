import { brand } from "@/lib/config/brand";

/**
 * Standard links plus the franchise-offering legal notice. The notice
 * lives here, under the conversion section, so the required language is
 * always on the page without crowding the assessment.
 */
export function BridgeFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[880px] px-5 py-10 sm:px-8">
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground"
        >
          <a href={brand.privacyPolicyUrl} className="hover:text-foreground hover:underline">
            Privacy Policy
          </a>
          <span aria-hidden className="text-border-strong">
            |
          </span>
          <a href={brand.termsUrl} className="hover:text-foreground hover:underline">
            Terms
          </a>
          <span aria-hidden className="text-border-strong">
            |
          </span>
          <a href="#legal" className="hover:text-foreground hover:underline">
            Franchise Disclosure &amp; Legal
          </a>
        </nav>

        <section id="legal" className="mt-6 scroll-mt-6">
          <h2 className="text-[12.5px] font-bold text-foreground">{brand.legalNoticeTitle}</h2>
          <div className="mt-2 space-y-2">
            {brand.legalNotice.map((paragraph, index) => (
              <p key={index} className="text-[11.5px] leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <p className="mt-6 text-[11.5px] text-faint-foreground">
          © {new Date().getFullYear()} {brand.orgName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
