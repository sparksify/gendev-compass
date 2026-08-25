import { brand } from "@/lib/config/brand";
import { getAppUrl } from "@/lib/config/env";
import type { LeadRecord } from "@/types/lead";

/**
 * Shared HTML shell for advisor notifications.
 *
 * Deliberately plain: inline styles, no external CSS or images, a single
 * column. Email clients are not browsers, and an advisor alert needs to be
 * legible in a notification preview more than it needs to be pretty.
 */

export interface EmailBody {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; contentBase64: string }>;
}

export interface DetailRow {
  label: string;
  value: string | null;
  /** Renders full-width above the value — for long free-text answers. */
  block?: boolean;
}

/** Escapes untrusted values (investor free text) before HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function investorName(lead: LeadRecord): string {
  return `${lead.first_name} ${lead.last_name}`.trim() || lead.email;
}

/**
 * Deep link to the investor's advisor-side record. The route
 * (app/advisor/(app)/investors/[id]) keys off the lead id and is behind the
 * staff session, so the link is safe to email — it grants nothing on its own.
 * Returns null when no app URL is configured rather than emitting a broken
 * localhost link into a real inbox.
 */
export function investorUrl(lead: LeadRecord): string | null {
  const base = getAppUrl();
  if (!base || base.includes("localhost")) return null;
  return `${base}/advisor/investors/${lead.id}`;
}

/** A row that survived the empty-value filter. */
export type PresentRow = DetailRow & { value: string };

/** Drops rows whose value is missing so the email never shows empty fields. */
export function presentRows(rows: DetailRow[]): PresentRow[] {
  return rows.filter((row): row is PresentRow => {
    return typeof row.value === "string" && row.value.trim().length > 0;
  });
}

function renderRow(row: PresentRow): string {
  const label = escapeHtml(row.label);
  const value = escapeHtml(row.value).replace(/\n/g, "<br />");

  if (row.block) {
    return `
      <tr>
        <td colspan="2" style="padding:12px 0 0 0;border-top:1px solid #e8eaed;">
          <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7b8794;">${label}</div>
          <div style="margin-top:4px;font-size:14px;line-height:1.55;color:#1f2933;">${value}</div>
        </td>
      </tr>`;
  }

  return `
      <tr>
        <td style="padding:10px 16px 10px 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7b8794;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:10px 0;font-size:14px;color:#1f2933;vertical-align:top;">${value}</td>
      </tr>`;
}

export interface ShellOptions {
  /** Small line above the headline, e.g. "Investor Qualification". */
  eyebrow: string;
  headline: string;
  /** One-sentence summary under the headline. */
  intro: string;
  rows: DetailRow[];
  cta?: { href: string; label: string } | null;
  /** Closing note, e.g. why this email was sent. */
  footnote?: string | null;
}

export function renderEmail(options: ShellOptions): { html: string; text: string } {
  const rows = presentRows(options.rows);
  const rowsHtml = rows.map(renderRow).join("");

  const ctaHtml = options.cta
    ? `
          <tr>
            <td colspan="2" style="padding:24px 0 0 0;">
              <a href="${escapeHtml(options.cta.href)}"
                 style="display:inline-block;background:#0f2a43;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">
                ${escapeHtml(options.cta.label)}
              </a>
            </td>
          </tr>`
    : "";

  const footnoteHtml = options.footnote
    ? `<p style="margin:28px 0 0 0;font-size:12px;line-height:1.5;color:#9aa5b1;">${escapeHtml(options.footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e2e6ea;">
      <tr>
        <td style="padding:28px 28px 0 28px;">
          <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7b8794;">${escapeHtml(options.eyebrow)}</div>
          <h1 style="margin:8px 0 0 0;font-size:20px;line-height:1.35;font-weight:600;color:#0f2a43;">${escapeHtml(options.headline)}</h1>
          <p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:#52606d;">${escapeHtml(options.intro)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 28px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rowsHtml}
            ${ctaHtml}
          </table>
          ${footnoteHtml}
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0 auto;font-size:11px;line-height:1.5;color:#9aa5b1;text-align:center;">
      Sent by ${escapeHtml(brand.productName)}.
    </p>
  </body>
</html>`;

  const textLines = [
    options.eyebrow.toUpperCase(),
    "",
    options.headline,
    options.intro,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ];
  if (options.cta) textLines.push("", `${options.cta.label}: ${options.cta.href}`);
  if (options.footnote) textLines.push("", options.footnote);
  textLines.push("", `Sent by ${brand.productName}.`);

  return { html, text: textLines.join("\n") };
}
