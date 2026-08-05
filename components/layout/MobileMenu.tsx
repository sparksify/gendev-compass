"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";

interface MobileMenuProps {
  token: string;
  supportEmail: string;
  consultationAvailable: boolean;
}

/**
 * Mobile hamburger menu (top right, below lg): opens a right-side drawer
 * carrying the same navigation as the desktop sidebar rail. Closes on
 * navigation, backdrop tap, the close button, or Escape.
 */
export function MobileMenu({ token, supportEmail, consultationAvailable }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Route changes (e.g. tapping a nav link) dismiss the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open menu"
        className="flex size-10 items-center justify-center rounded-control text-secondary-foreground transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Menu className="size-[22px]" strokeWidth={1.8} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation"
            className="absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col overflow-y-auto bg-card shadow-2xl"
          >
            <div className="flex h-[59px] shrink-0 items-center justify-between border-b border-border pl-5 pr-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-control text-secondary-foreground transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-[20px]" strokeWidth={1.8} />
              </button>
            </div>
            {/* Same-page anchor taps (e.g. #faq) don't change the pathname,
                so any link tap inside the drawer also dismisses it. */}
            <div
              className="flex min-h-0 flex-1 flex-col pb-6"
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <SidebarNavigation
                token={token}
                supportEmail={supportEmail}
                consultationAvailable={consultationAvailable}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
