import Image from "next/image";
import { brand } from "@/lib/config/brand";

export function PortalHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image src={brand.logoPath} alt={brand.brandName} width={32} height={32} priority />
          <div>
            <p className="text-sm font-semibold leading-tight text-ink">{brand.brandName}</p>
            <p className="text-xs leading-tight text-ink-muted">{brand.portalLabel}</p>
          </div>
        </div>
        <a
          href={`mailto:${brand.supportEmail}`}
          className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Support
        </a>
      </div>
    </header>
  );
}
