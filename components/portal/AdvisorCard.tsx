import Image from "next/image";
import { brand } from "@/lib/config/brand";

export function AdvisorCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5">
      <Image
        src={brand.advisorPhotoPath}
        alt={`${brand.advisorName}, advisor`}
        width={56}
        height={56}
        className="rounded-full border border-line"
      />
      <div>
        <p className="text-sm font-semibold text-ink">{brand.advisorName}</p>
        <p className="text-sm text-ink-muted">Investor Consultation Advisor</p>
      </div>
    </div>
  );
}
