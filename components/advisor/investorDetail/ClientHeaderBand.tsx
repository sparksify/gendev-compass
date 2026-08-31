import Link from "next/link";
import { Calendar, Globe, Mail, MapPin, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The deep-green identity band that opens the client detail page: who they
 * are, the facts you'd repeat on a call, the record's actions, and the
 * section tab row tucked into the same block.
 *
 * The band is the one place in the advisor app that reverses out to white on
 * green, so its type and hairlines are spelled out here rather than reaching
 * for tokens meant for the light ground.
 */

const CONTACT_LINK =
  "inline-flex items-center gap-1.5 text-white/95 transition-colors hover:text-white hover:underline";

export interface ClientHeaderTab {
  /** In-page anchor — every section lives on this one page. */
  href: string;
  label: string;
  count?: number | null;
}

export function ClientHeaderBand({
  name,
  initials,
  email,
  phone,
  meta,
  followUp,
  tabs,
  actions,
}: {
  name: string;
  initials: string;
  email: string;
  phone?: string | null;
  /** The faint second line: location, source, advisor, joined. */
  meta: Array<{ icon: "location" | "source" | "advisor" | "joined"; label: string }>;
  /** Present when a follow-up is overdue; the string is the reason. */
  followUp?: string | null;
  tabs: ClientHeaderTab[];
  actions?: React.ReactNode;
}) {
  const ICONS = {
    location: MapPin,
    source: Globe,
    advisor: User,
    joined: Calendar,
  } as const;

  return (
    <div className="overflow-hidden rounded-card bg-[linear-gradient(135deg,#1b7a61,#135c49)]">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-[13px]">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-extrabold text-[#134a3b]"
          >
            {initials}
          </span>

          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[18px] font-extrabold text-white">{name}</span>

              {followUp && (
                <span
                  title={followUp}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#c2410c]"
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-[#c2410c]" />
                  Follow-up Due
                </span>
              )}
            </div>

            {/* Email and phone, spelled out (not just icon buttons) so
                they're readable at a glance right under the name. */}
            <div className="flex flex-wrap items-center gap-x-[15px] gap-y-1 text-[13px] font-semibold">
              <a href={`mailto:${email}`} className={CONTACT_LINK} aria-label={`Email ${name}`}>
                <Mail className="size-3 shrink-0" strokeWidth={2} />
                {email}
              </a>
              {phone && (
                <a href={`tel:${phone}`} className={CONTACT_LINK} aria-label={`Call ${name}`}>
                  <Phone className="size-3 shrink-0" strokeWidth={2} />
                  {phone}
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-[15px] gap-y-1 text-[12.5px] font-semibold text-white/95">
              {meta.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <span key={`${item.icon}-${item.label}`} className="inline-flex items-center gap-1.5">
                    <Icon className="size-3 shrink-0" strokeWidth={2} />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>

      <nav
        className="flex flex-wrap items-center gap-1 border-t border-white/15 px-4"
        aria-label="Client sections"
      >
        {tabs.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-[2.5px] px-[11px] pb-[7px] pt-[9px] text-[12.5px] transition-colors",
              index === 0
                ? "border-accent font-extrabold text-white"
                : "border-transparent font-semibold text-white/85 hover:text-white",
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="tabular inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-white/20 px-1 text-[10px] font-bold text-white">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
