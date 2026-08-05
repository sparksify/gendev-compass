import { describe, expect, it } from "vitest";
import { suggestNextAction } from "@/lib/advisor/nextAction";
import { hoursAgo, makeAppointment, makeLead, makeVideo } from "./helpers";

describe("suggested next action", () => {
  it("suggests scheduling after questionnaire with no booking", () => {
    const lead = makeLead({
      current_stage: "QUESTIONNAIRE_COMPLETED",
      questionnaire_completed_at: hoursAgo(3),
    });
    expect(suggestNextAction(lead, [], null)).toBe("Schedule follow-up");
  });

  it("suggests preparing when a consultation is booked", () => {
    const lead = makeLead({ current_stage: "CONSULTATION_SCHEDULED" });
    expect(suggestNextAction(lead, [makeAppointment({ status: "SCHEDULED" })], null)).toBe(
      "Prepare for consultation",
    );
  });

  it("prioritizes FDD follow-up when sent but unacknowledged", () => {
    const lead = makeLead({
      current_stage: "FDD_SENT",
      fdd_status: "fdd_sent",
      fdd_sent_at: hoursAgo(10),
    });
    expect(suggestNextAction(lead, [], null)).toBe("Follow up on FDD");
  });

  it("encourages questionnaire completion on high video engagement", () => {
    const lead = makeLead({ current_stage: "ENGAGED" });
    const video = makeVideo({ highest_percent_watched: 75 });
    expect(suggestNextAction(lead, [], video)).toBe("Encourage questionnaire completion");
  });

  it("suggests rebooking a cancelled consultation", () => {
    const lead = makeLead({ current_stage: "CONSULTATION_SCHEDULED" });
    expect(suggestNextAction(lead, [makeAppointment({ status: "CANCELLED" })], null)).toBe(
      "Rebook cancelled consultation",
    );
  });

  it("suggests due diligence once the FDD is received", () => {
    const lead = makeLead({ current_stage: "FDD_ACKNOWLEDGED", fdd_status: "fdd_received" });
    expect(suggestNextAction(lead, [], null)).toBe("Begin due diligence discussion");
  });

  it("is quiet for closed stages", () => {
    expect(suggestNextAction(makeLead({ current_stage: "NOT_A_FIT" }), [], null)).toBe("—");
    expect(suggestNextAction(makeLead({ current_stage: "CLOSED_INVESTED" }), [], null)).toBe("—");
  });
});
