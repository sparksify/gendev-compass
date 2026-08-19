import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { getStore } from "@/lib/store";
import { renderQuestionnairePdf } from "@/lib/advisor/questionnairePdf";

export const dynamic = "force-dynamic";

/** Downloads the lead's completed questionnaire as a formatted PDF report. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();
  const [questionnaire, submissions] = await Promise.all([
    store.getQuestionnaire(lead.id),
    store.getSubmissionsForLead(lead.id).catch(() => []),
  ]);
  if (!questionnaire) {
    return NextResponse.json(
      { success: false, error: "This investor has not completed the questionnaire." },
      { status: 404 },
    );
  }

  const latest = submissions[0] ?? null;

  try {
    const pdf = await renderQuestionnairePdf({
      lead,
      questionnaire,
      submittedAt: latest?.submitted_at ?? lead.questionnaire_completed_at ?? questionnaire.created_at,
      questionnaireVersion: latest?.questionnaire_version ?? null,
    });

    const safeName = `${lead.first_name}-${lead.last_name}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    // Uint8Array -> a fresh ArrayBuffer-backed copy for the Response body.
    const body = new Uint8Array(pdf);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="investor-qualification-${safeName || lead.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[questionnaire-pdf] render failed:", error);
    return NextResponse.json(
      { success: false, error: "The PDF could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
