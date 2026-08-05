"use client";

import { Mail, Phone } from "lucide-react";

interface AdvisorContactProps {
  token: string;
  phone: string;
  email: string;
}

function track(token: string, eventName: "advisor_phone_clicked" | "advisor_email_clicked") {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, eventName }),
  }).catch(() => undefined);
}

/** Advisor phone and email rows with click tracking (fire-and-forget). */
export function AdvisorContact({ token, phone, email }: AdvisorContactProps) {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border-soft pt-3.5">
      <p className="flex items-center gap-[9px] text-[12.5px]">
        <Phone className="size-[15px] shrink-0 text-faint-foreground" strokeWidth={1.6} />
        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          onClick={() => track(token, "advisor_phone_clicked")}
          className="min-w-0 break-words text-secondary-foreground hover:text-foreground"
        >
          {phone}
        </a>
      </p>
      <p className="flex items-center gap-[9px] text-[12.5px]">
        <Mail className="size-[15px] shrink-0 text-faint-foreground" strokeWidth={1.6} />
        <a
          href={`mailto:${email}`}
          onClick={() => track(token, "advisor_email_clicked")}
          className="min-w-0 break-words text-primary hover:text-primary-hover"
        >
          {email}
        </a>
      </p>
    </div>
  );
}
