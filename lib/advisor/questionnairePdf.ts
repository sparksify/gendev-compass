import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { brand } from "@/lib/config/brand";
import { labelIn, labelForValue } from "@/lib/advisor/questionnaireCatalog";
import {
  CASH_CONTRIBUTION_RANGES,
  CREDIT_SCORE_RANGES,
  EXISTING_ENTITY_OPTIONS,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  FUNDING_ASSISTANCE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  LENDER_STATUS_OPTIONS,
  PRIOR_FINANCING_EXPERIENCE_OPTIONS,
  type QuestionnaireRecord,
} from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";

/**
 * Renders a lead's completed questionnaire as a downloadable PDF report.
 *
 * Layout is deliberately plain-typography (Helvetica, no images) so the
 * route stays dependency-light and works in the serverless runtime. The
 * section grouping mirrors the portal questionnaire so an advisor can read
 * the report against the form one-to-one.
 */

export interface QuestionnairePdfInput {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord;
  submittedAt: string | null;
  questionnaireVersion: string | null;
}

// Letter, 1" text column margins.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const LABEL_COL_WIDTH = 190;

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.07, 0.36, 0.25);
const RULE = rgb(0.85, 0.87, 0.89);

/** Helvetica is WinAnsi-only; drop anything it cannot encode. */
function sanitize(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n -ÿ]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitize(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Hard-break words wider than the column.
      let remainder = word;
      while (font.widthOfTextAtSize(remainder, size) > maxWidth) {
        let cut = remainder.length;
        while (cut > 1 && font.widthOfTextAtSize(remainder.slice(0, cut), size) > maxWidth) {
          cut -= 1;
        }
        lines.push(remainder.slice(0, cut));
        remainder = remainder.slice(cut);
      }
      current = remainder;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: brand.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Field {
  label: string;
  value: string;
  /** Render the value full-width under the label (free-text answers). */
  block?: boolean;
}

interface Section {
  title: string;
  fields: Field[];
}

function buildSections(questionnaire: QuestionnaireRecord): Section[] {
  const financingApplies = Boolean(
    questionnaire.financing_need && questionnaire.financing_need !== "no",
  );
  const na = "N/A - no financing needed";

  const fundingSources =
    Array.isArray(questionnaire.anticipated_funding_sources) &&
    questionnaire.anticipated_funding_sources.length > 0
      ? questionnaire.anticipated_funding_sources
          .map((source) => labelIn(FUNDING_SOURCE_OPTIONS, source))
          .join(", ")
      : "Not Provided";

  return [
    {
      title: "1. Investment Goals",
      fields: [
        { label: "Investment timeline", value: labelForValue(questionnaire.investment_timeline) },
        { label: "Liquid capital available", value: labelForValue(questionnaire.liquid_capital) },
        { label: "Estimated net worth", value: labelForValue(questionnaire.net_worth) },
      ],
    },
    {
      title: "2. Location",
      fields: [
        {
          label: "Street address",
          value:
            [questionnaire.address_line_1, questionnaire.address_line_2]
              .filter(Boolean)
              .join(", ") || "Not Provided",
        },
        { label: "City", value: questionnaire.city || "Not Provided" },
        { label: "State / province", value: questionnaire.state || "Not Provided" },
        { label: "ZIP / postal code", value: questionnaire.postal_code || "Not Provided" },
        { label: "Country", value: questionnaire.country || "Not Provided" },
      ],
    },
    {
      title: "3. Credit Profile",
      fields: [
        {
          label: "Estimated credit score (self-reported)",
          value: labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range),
        },
      ],
    },
    {
      title: "4. Investment Funding",
      fields: [
        { label: "Anticipated funding sources", value: fundingSources },
        {
          label: "Financing need",
          value: labelIn(FINANCING_NEED_OPTIONS, questionnaire.financing_need),
        },
        {
          label: "Prefers to finance",
          value: financingApplies
            ? labelIn(FINANCING_PERCENTAGE_OPTIONS, questionnaire.preferred_financing_percentage)
            : na,
        },
        {
          label: "Lender status",
          value: financingApplies
            ? labelIn(LENDER_STATUS_OPTIONS, questionnaire.lender_status)
            : na,
        },
        {
          label: "Wants financing help",
          value: financingApplies
            ? labelIn(FUNDING_ASSISTANCE_OPTIONS, questionnaire.funding_assistance_requested)
            : na,
        },
        {
          label: "Comfortable cash contribution",
          value: labelIn(CASH_CONTRIBUTION_RANGES, questionnaire.available_cash_contribution),
        },
        {
          label: "Existing business entity",
          value: labelIn(EXISTING_ENTITY_OPTIONS, questionnaire.existing_business_entity),
        },
        {
          label: "Prior SBA / commercial financing",
          value: labelIn(
            PRIOR_FINANCING_EXPERIENCE_OPTIONS,
            questionnaire.prior_business_financing_experience,
          ),
        },
      ],
    },
    {
      title: "5. Business Experience",
      fields: [
        {
          label: "Owned or operated a business",
          value: labelForValue(questionnaire.business_ownership),
        },
      ],
    },
    {
      title: "6. Opportunity Fit",
      fields: [
        {
          label: "What interested them most about the opportunity",
          value: questionnaire.primary_interest || "Not Provided",
          block: true,
        },
        {
          label: "Questions they want answered during the consultation",
          value: questionnaire.remaining_questions || "Not Provided",
          block: true,
        },
        {
          label: "What would need to be true for this to make sense",
          value: questionnaire.decision_criteria || "Not Provided",
          block: true,
        },
      ],
    },
    {
      title: "7. Decision Process",
      fields: [
        {
          label: "Who participates in the decision",
          value: labelForValue(questionnaire.decision_participants),
        },
        {
          label: "Information accuracy",
          value: questionnaire.accuracy_confirmed ? "Confirmed" : "Not confirmed",
        },
      ],
    },
  ];
}

export async function renderQuestionnairePdf(input: QuestionnairePdfInput): Promise<Uint8Array> {
  const { lead, questionnaire } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const investorName = sanitize(`${lead.first_name} ${lead.last_name}`.trim() || lead.email);
  doc.setTitle(`Investor Qualification - ${investorName}`);
  doc.setSubject("Completed investor qualification questionnaire");
  doc.setCreator(brand.productName);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) newPage();
  };
  const draw = (
    text: string,
    options: { x?: number; size: number; font: PDFFont; color: RGB },
  ) => {
    page.drawText(text, {
      x: options.x ?? MARGIN_X,
      y,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  };

  // ------------------------------------------------------------- header
  draw(brand.productName.toUpperCase(), { size: 8.5, font: bold, color: ACCENT });
  y -= 20;
  draw("Investor Qualification Report", { size: 19, font: bold, color: INK });
  y -= 24;
  draw(investorName, { size: 13, font: bold, color: INK });
  y -= 16;

  const qualification =
    lead.qualification_result === "qualified"
      ? "Qualified"
      : lead.qualification_result === "review_required"
        ? "Review required"
        : null;
  const metaParts = [
    lead.email,
    lead.phone,
    `Submitted ${formatStamp(input.submittedAt)}`,
    input.questionnaireVersion ? `Version ${input.questionnaireVersion}` : null,
    qualification
      ? `${qualification}${typeof lead.qualification_score === "number" ? ` (score ${lead.qualification_score})` : ""}`
      : null,
  ].filter(Boolean) as string[];
  for (const line of wrapText(metaParts.join("  ·  "), font, 9.5, CONTENT_WIDTH)) {
    draw(line, { size: 9.5, font, color: MUTED });
    y -= 13;
  }
  y -= 6;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: RULE,
  });
  y -= 22;

  // ------------------------------------------------------------ sections
  for (const section of buildSections(questionnaire)) {
    ensure(46);
    draw(section.title, { size: 11.5, font: bold, color: ACCENT });
    y -= 18;

    for (const field of section.fields) {
      if (field.block) {
        const labelLines = wrapText(field.label, bold, 9, CONTENT_WIDTH);
        const valueLines = wrapText(field.value, font, 10, CONTENT_WIDTH);
        ensure(labelLines.length * 12 + Math.min(valueLines.length, 3) * 13 + 10);
        for (const line of labelLines) {
          draw(line, { size: 9, font: bold, color: MUTED });
          y -= 12;
        }
        y -= 2;
        for (const line of valueLines) {
          ensure(13);
          draw(line, { size: 10, font, color: INK });
          y -= 13;
        }
        y -= 8;
      } else {
        const valueLines = wrapText(
          field.value,
          font,
          10,
          CONTENT_WIDTH - LABEL_COL_WIDTH - 12,
        );
        const rowHeight = Math.max(valueLines.length, 1) * 13;
        ensure(rowHeight + 4);
        draw(field.label, { size: 9, font, color: MUTED });
        valueLines.forEach((line, index) => {
          page.drawText(line, {
            x: MARGIN_X + LABEL_COL_WIDTH + 12,
            y: y - index * 13,
            size: 10,
            font,
            color: INK,
          });
        });
        y -= rowHeight + 4;
      }
    }
    y -= 12;
  }

  // ------------------------------------------------------------- footers
  const pages = doc.getPages();
  const generated = formatStamp(new Date().toISOString());
  pages.forEach((p, index) => {
    const footer = `${brand.productName}  ·  Confidential  ·  Generated ${generated}`;
    p.drawText(footer, {
      x: MARGIN_X,
      y: 36,
      size: 8,
      font,
      color: MUTED,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    p.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(pageLabel, 8),
      y: 36,
      size: 8,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}
