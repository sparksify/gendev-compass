/**
 * Advisor-backend development seed: staff users plus example investors at
 * different pipeline stages, with questionnaires, video engagement,
 * appointments, FDD records, notes, and timeline events.
 *
 *   npm run seed:advisor
 *
 * Idempotent: skips anything that already exists (matched by email).
 * All personal data below is fictional. Login credentials are printed at
 * the end and documented in the README — override them with
 * SEED_ADMIN_PASSWORD / SEED_ADVISOR_PASSWORD. Do not run against
 * production data.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function iso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

async function main() {
  const { getStore } = await import("../lib/store");
  const { generatePortalToken } = await import("../lib/portal/tokens");
  const { hashPassword } = await import("../lib/advisor/password");
  const { buildAnswerSnapshot, QUESTIONNAIRE_VERSION } = await import(
    "../lib/advisor/questionnaireCatalog"
  );

  const store = getStore();

  // -------------------------------------------------------------------------
  // Staff users
  // -------------------------------------------------------------------------
  const adminEmail = "admin@gendev.test";
  const advisorEmail = "darko@gendev.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "gendev-admin-dev-2026";
  const advisorPassword = process.env.SEED_ADVISOR_PASSWORD ?? "gendev-darko-dev-2026";

  let admin = await store.getStaffUserByEmail(adminEmail);
  if (!admin) {
    admin = await store.createStaffUser({
      first_name: "Alex",
      last_name: "Admin",
      email: adminEmail,
      password_hash: hashPassword(adminPassword),
      role: "ADMIN",
    });
    console.log("Created admin:", adminEmail);
  }

  let darko = await store.getStaffUserByEmail(advisorEmail);
  if (!darko) {
    darko = await store.createStaffUser({
      first_name: "Darko",
      last_name: "Petrovic",
      email: advisorEmail,
      password_hash: hashPassword(advisorPassword),
      role: "ADVISOR",
    });
    console.log("Created advisor:", advisorEmail);
  }

  // Second advisor (development-only credentials, fictional person).
  const advisor2Email = "jordan@gendev.test";
  const advisor2Password = process.env.SEED_ADVISOR2_PASSWORD ?? "gendev-jordan-dev-2026";
  let jordan = await store.getStaffUserByEmail(advisor2Email);
  if (!jordan) {
    jordan = await store.createStaffUser({
      first_name: "Jordan",
      last_name: "Ellis",
      email: advisor2Email,
      password_hash: hashPassword(advisor2Password),
      role: "ADVISOR",
    });
    console.log("Created advisor:", advisor2Email);
  }

  // -------------------------------------------------------------------------
  // Platform domain: organization, brands, staff profiles + memberships.
  // -------------------------------------------------------------------------
  const { resolveDefaultOrganization } = await import("../lib/domain/organizations");
  const { resolveDefaultBrand } = await import("../lib/domain/brands");
  const { resolveAdvisorContext } = await import("../lib/domain/memberships");
  const { ensureLeadDomainChain } = await import("../lib/domain/chain");

  const organization = await resolveDefaultOrganization();
  const defaultBrand = await resolveDefaultBrand(organization);

  let secondBrand = await store.getBrandBySlug("gendev-demo-brand");
  if (!secondBrand) {
    secondBrand = await store.createBrand({
      organization_id: organization.id,
      name: "GenDev Demo Second Brand",
      slug: "gendev-demo-brand",
    });
    console.log("Created second brand:", secondBrand.slug);
  }

  await resolveAdvisorContext(admin);
  await resolveAdvisorContext(darko);
  const jordanContext = await resolveAdvisorContext(jordan);
  console.log(
    `Organization '${organization.slug}' ready with brands: ${defaultBrand.slug}, ${secondBrand.slug}`,
  );

  // -------------------------------------------------------------------------
  // Example investors (all data fictional)
  // -------------------------------------------------------------------------
  interface SeedInvestor {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    state: string;
    stage: string;
    createdDaysAgo: number;
    lastActivityHoursAgo: number;
    questionnaire?: {
      investmentTimeline: string;
      liquidCapital: string;
      netWorth: string;
      businessOwnership: string;
      primaryInterest: string;
      remainingQuestions: string;
      decisionCriteria: string;
      decisionParticipants: string;
      submittedHoursAgo: number;
    };
    video?: { percent: number; seconds: number; plays: number; completed: boolean; hoursAgo: number };
    appointment?: { status: string; startInHours: number; timeZone: string };
    fdd?: {
      status: string;
      requestedHoursAgo?: number;
      sentHoursAgo?: number;
      deliveredHoursAgo?: number;
      receivedHoursAgo?: number;
    };
    note?: string;
  }

  const investors: SeedInvestor[] = [
    {
      firstName: "Maria",
      lastName: "Chen",
      email: "maria.chen@example.test",
      phone: "+15550100001",
      state: "Texas",
      stage: "QUESTIONNAIRE_COMPLETED",
      createdDaysAgo: 3,
      lastActivityHoursAgo: 30,
      questionnaire: {
        investmentTimeline: "within-30-days",
        liquidCapital: "250k-499k",
        netWorth: "1m-2.4m",
        businessOwnership: "yes-currently",
        primaryInterest: "Recurring revenue model and territory availability in the Dallas metro.",
        remainingQuestions: "What does week-one onboarding look like, and how fast can I open?",
        decisionCriteria: "Unit economics, franchisor support quality, and time to break even.",
        decisionParticipants: "spouse",
        submittedHoursAgo: 30,
      },
      video: { percent: 100, seconds: 540, plays: 2, completed: true, hoursAgo: 32 },
      note: "Strong candidate — runs two logistics businesses. Wants Dallas North territory.",
    },
    {
      firstName: "James",
      lastName: "Okafor",
      email: "james.okafor@example.test",
      phone: "+15550100002",
      state: "Florida",
      stage: "CONSULTATION_SCHEDULED",
      createdDaysAgo: 6,
      lastActivityHoursAgo: 8,
      questionnaire: {
        investmentTimeline: "immediately",
        liquidCapital: "500k-999k",
        netWorth: "2.5m-4.9m",
        businessOwnership: "yes-previously",
        primaryInterest: "Exited my last company; looking for a semi-absentee operation.",
        remainingQuestions: "Can this run with a general manager from day one?",
        decisionCriteria: "Scalability to multiple units and manager-run viability.",
        decisionParticipants: "independent",
        submittedHoursAgo: 50,
      },
      video: { percent: 92, seconds: 500, plays: 1, completed: true, hoursAgo: 52 },
      appointment: { status: "SCHEDULED", startInHours: 6, timeZone: "America/New_York" },
      note: "Consultation booked for today — review his multi-unit questions beforehand.",
    },
    {
      firstName: "Sarah",
      lastName: "Lindqvist",
      email: "sarah.lindqvist@example.test",
      phone: "+15550100003",
      state: "Arizona",
      stage: "FDD_SENT",
      createdDaysAgo: 12,
      lastActivityHoursAgo: 70,
      questionnaire: {
        investmentTimeline: "within-90-days",
        liquidCapital: "1m-2.4m",
        netWorth: "5m-plus",
        businessOwnership: "yes-currently",
        primaryInterest: "Diversifying out of commercial real estate into operating businesses.",
        remainingQuestions: "Territory protection terms and franchisor renewal history.",
        decisionCriteria: "FDD Item 19 numbers and existing franchisee references.",
        decisionParticipants: "financial-advisor",
        submittedHoursAgo: 200,
      },
      video: { percent: 100, seconds: 560, plays: 3, completed: true, hoursAgo: 210 },
      appointment: { status: "COMPLETED", startInHours: -96, timeZone: "America/Phoenix" },
      fdd: { status: "fdd_sent", requestedHoursAgo: 80, sentHoursAgo: 70 },
      note: "Consultation went well. FDD sent — follow up if not acknowledged by Friday.",
    },
    {
      firstName: "David",
      lastName: "Reyes",
      email: "david.reyes@example.test",
      phone: "+15550100004",
      state: "California",
      stage: "ENGAGED",
      createdDaysAgo: 4,
      lastActivityHoursAgo: 60,
      video: { percent: 75, seconds: 380, plays: 2, completed: false, hoursAgo: 60 },
    },
    {
      firstName: "Priya",
      lastName: "Nair",
      email: "priya.nair@example.test",
      phone: "+15550100005",
      state: "New Jersey",
      stage: "FDD_ACKNOWLEDGED",
      createdDaysAgo: 21,
      lastActivityHoursAgo: 20,
      questionnaire: {
        investmentTimeline: "within-30-days",
        liquidCapital: "2.5m-plus",
        netWorth: "5m-plus",
        businessOwnership: "yes-currently",
        primaryInterest: "Adding a third brand to my franchise portfolio.",
        remainingQuestions: "Development schedule flexibility for a 3-unit commitment.",
        decisionCriteria: "Multi-unit economics and development timeline.",
        decisionParticipants: "business-partner",
        submittedHoursAgo: 480,
      },
      video: { percent: 100, seconds: 555, plays: 1, completed: true, hoursAgo: 490 },
      appointment: { status: "COMPLETED", startInHours: -300, timeZone: "America/New_York" },
      fdd: {
        status: "waiting_period_active",
        requestedHoursAgo: 290,
        sentHoursAgo: 280,
        deliveredHoursAgo: 275,
        receivedHoursAgo: 20,
      },
      note: "Experienced multi-unit operator. Acknowledged FDD — start due-diligence call list.",
    },
    {
      firstName: "Tom",
      lastName: "Becker",
      email: "tom.becker@example.test",
      phone: "+15550100006",
      state: "Ohio",
      stage: "NEW_LEAD",
      createdDaysAgo: 1,
      lastActivityHoursAgo: 24,
    },
  ];

  for (const seed of investors) {
    const existing = await store.getLeadByEmail(seed.email);
    if (existing) {
      console.log("Investor already seeded:", seed.email);
      continue;
    }

    const lead = await store.createLead({
      portal_token: generatePortalToken(),
      first_name: seed.firstName,
      last_name: seed.lastName,
      email: seed.email,
      phone: seed.phone,
      state: seed.state,
      source: "facebook-lead-ad",
      campaign: "pilot-campaign",
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: null,
      initial_net_worth: null,
      initial_business_owner: null,
    });

    const created = iso(seed.createdDaysAgo * DAY);
    const lastActivity = iso(seed.lastActivityHoursAgo * HOUR);
    await store.insertEvent(lead.id, "lead_created", { source: "facebook-lead-ad" }, null, {
      source: "seed",
      occurredAt: created,
    });

    if (seed.stage !== "NEW_LEAD") {
      await store.insertEvent(lead.id, "portal_opened", null, null, {
        source: "seed",
        occurredAt: iso(seed.createdDaysAgo * DAY - HOUR),
      });
    }

    if (seed.video) {
      await store.upsertVideoProgress(lead.id, {
        wistia_media_id: "seed-media",
        highest_percent_watched: seed.video.percent,
        accumulated_seconds_watched: seed.video.seconds,
        last_playhead_position: seed.video.seconds,
        started: true,
        completed: seed.video.completed,
        play_count: seed.video.plays,
        first_played_at: iso(seed.video.hoursAgo * HOUR + HOUR),
        last_event_at: iso(seed.video.hoursAgo * HOUR),
      });
      await store.insertEvent(lead.id, "video_started", null, null, {
        source: "seed",
        occurredAt: iso(seed.video.hoursAgo * HOUR + HOUR),
      });
      for (const milestone of [25, 50, 75]) {
        if (seed.video.percent >= milestone) {
          await store.insertEvent(
            lead.id,
            `video_progress_${milestone}`,
            { percent: milestone },
            null,
            { source: "seed", occurredAt: iso(seed.video.hoursAgo * HOUR) },
          );
        }
      }
      if (seed.video.completed) {
        await store.insertEvent(lead.id, "video_completion_threshold_reached", null, null, {
          source: "seed",
          occurredAt: iso(seed.video.hoursAgo * HOUR),
        });
      }
    }

    if (seed.questionnaire) {
      const submittedAt = iso(seed.questionnaire.submittedHoursAgo * HOUR);
      await store.createQuestionnaire({
        lead_id: lead.id,
        investment_timeline: seed.questionnaire.investmentTimeline,
        liquid_capital: seed.questionnaire.liquidCapital,
        net_worth: seed.questionnaire.netWorth,
        business_ownership: seed.questionnaire.businessOwnership,
        primary_interest: seed.questionnaire.primaryInterest,
        remaining_questions: seed.questionnaire.remainingQuestions,
        decision_criteria: seed.questionnaire.decisionCriteria,
        decision_participants: seed.questionnaire.decisionParticipants,
        accuracy_confirmed: true,
      });
      await store.createSubmission({
        lead_id: lead.id,
        questionnaire_version: QUESTIONNAIRE_VERSION,
        submitted_at: submittedAt,
        answers: buildAnswerSnapshot({
          investmentTimeline: seed.questionnaire.investmentTimeline as never,
          liquidCapital: seed.questionnaire.liquidCapital as never,
          netWorth: seed.questionnaire.netWorth as never,
          businessOwnership: seed.questionnaire.businessOwnership as never,
          primaryInterest: seed.questionnaire.primaryInterest,
          remainingQuestions: seed.questionnaire.remainingQuestions,
          decisionCriteria: seed.questionnaire.decisionCriteria,
          decisionParticipants: seed.questionnaire.decisionParticipants as never,
          accuracyConfirmed: true,
        }),
      });
      await store.insertEvent(lead.id, "questionnaire_submitted", null, null, {
        source: "seed",
        occurredAt: submittedAt,
      });
    }

    if (seed.appointment) {
      const start = new Date(Date.now() + seed.appointment.startInHours * HOUR).toISOString();
      await store.createAppointment({
        lead_id: lead.id,
        advisor_id: darko.id,
        external_appointment_id: `seed-appt-${lead.id.slice(0, 8)}`,
        scheduled_start: start,
        scheduled_end: new Date(
          Date.now() + seed.appointment.startInHours * HOUR + HOUR,
        ).toISOString(),
        time_zone: seed.appointment.timeZone,
        status: seed.appointment.status as never,
      });
      await store.insertEvent(lead.id, "consultation_booked", { scheduledStart: start }, null, {
        source: "seed",
      });
      if (seed.appointment.status === "COMPLETED") {
        await store.insertEvent(lead.id, "consultation_completed", null, null, { source: "seed" });
      }
    }

    if (seed.fdd) {
      const receivedAt = seed.fdd.receivedHoursAgo ? iso(seed.fdd.receivedHoursAgo * HOUR) : null;
      await store.updateLead(lead.id, {
        fdd_status: seed.fdd.status as never,
        fdd_requested_at: seed.fdd.requestedHoursAgo ? iso(seed.fdd.requestedHoursAgo * HOUR) : null,
        fdd_sent_at: seed.fdd.sentHoursAgo ? iso(seed.fdd.sentHoursAgo * HOUR) : null,
        fdd_delivered_at: seed.fdd.deliveredHoursAgo ? iso(seed.fdd.deliveredHoursAgo * HOUR) : null,
        fdd_received_at: receivedAt,
        // A 14-day waiting period from receipt, matching the default in lib/config/fdd.ts.
        fdd_eligible_at: receivedAt
          ? new Date(new Date(receivedAt).getTime() + 14 * 24 * HOUR).toISOString()
          : null,
        fdd_provider_envelope_id: `seed-envelope-${lead.id.slice(0, 8)}`,
        fdd_request_source: "seed",
      });
      await store.insertFddAudit({
        lead_id: lead.id,
        event: "fdd_requested",
        source: "seed",
        actor: "seed",
      });
      if (seed.fdd.sentHoursAgo) {
        await store.insertEvent(lead.id, "fdd_sent", null, null, { source: "seed" });
      }
      if (receivedAt) {
        await store.insertEvent(lead.id, "fdd_received", null, null, { source: "seed" });
      }
    }

    if (seed.note) {
      await store.createNote(lead.id, darko.id, seed.note);
      await store.insertEvent(lead.id, "note_added", null, null, {
        source: "seed",
        staffUserId: darko.id,
      });
    }

    await store.updateLead(lead.id, {
      current_stage: seed.stage,
      assigned_advisor_id: darko.id,
      last_activity_at: lastActivity,
      ...(seed.questionnaire
        ? { questionnaire_completed_at: iso(seed.questionnaire.submittedHoursAgo * HOUR) }
        : {}),
      ...(seed.appointment && seed.appointment.status !== "CANCELLED"
        ? {
            booked_at: iso(2 * HOUR),
            appointment_start_at: new Date(
              Date.now() + seed.appointment.startInHours * HOUR,
            ).toISOString(),
          }
        : {}),
    });

    console.log(`Seeded investor: ${seed.firstName} ${seed.lastName} (${seed.stage})`);
  }

  // -------------------------------------------------------------------------
  // Platform domain chains: connect every seeded lead to its organization /
  // client / brand / primary opportunity (idempotent get-or-create).
  // -------------------------------------------------------------------------
  const leads = await store.listLeads();
  for (const lead of leads) {
    await ensureLeadDomainChain(lead);
  }
  console.log(`Domain chains ensured for ${leads.length} lead(s).`);

  // Multi-opportunity example: Maria Chen also explores the second brand,
  // with her own independent stage, advisor, FDD workflow, and a pending
  // territory request. Closing/advancing one journey never touches the other.
  const mariaLead = await store.getLeadByEmail("maria.chen@example.test");
  if (mariaLead?.client_id) {
    const mariaClient = await store.getClientById(mariaLead.client_id);
    if (mariaClient) {
      const existingOpportunities = await store.listOpportunitiesForClient(mariaClient.id);
      let secondOpportunity =
        existingOpportunities.find((o) => o.brand_id === secondBrand.id) ?? null;
      if (!secondOpportunity) {
        secondOpportunity = await store.createOpportunity({
          organization_id: organization.id,
          client_id: mariaClient.id,
          brand_id: secondBrand.id,
          stage: "ENGAGED",
          assigned_advisor_profile_id: jordanContext.profile.id,
          assigned_advisor_membership_id: jordanContext.membership.id,
          priority: "high",
          metadata: { seeded: true },
        });
        await store.createOpportunityAssignment({
          opportunity_id: secondOpportunity.id,
          membership_id: jordanContext.membership.id,
          assignment_role: "PRIMARY_ADVISOR",
          is_primary: true,
        });
        console.log("Created second opportunity for Maria Chen (second brand).");
      }

      if (!(await store.getFddWorkflowByOpportunityId(secondOpportunity.id))) {
        await store.createFddWorkflow({
          organization_id: organization.id,
          client_id: mariaClient.id,
          opportunity_id: secondOpportunity.id,
          brand_id: secondBrand.id,
          status: "not_requested",
        });
      }

      // Territory Advisor data on the second opportunity: a pending search
      // + review request, scoped to the opportunity (not the client).
      const mariaSearches = await store.listTerritorySearchesForLead(mariaLead.id);
      if (!mariaSearches.some((s) => s.opportunity_id === secondOpportunity.id)) {
        const search = await store.createTerritorySearch({
          lead_id: mariaLead.id,
          brand_id: secondBrand.id,
          raw_query: "Dallas North metro, TX",
          city: "Dallas",
          state_code: "TX",
          radius_miles: 25,
          result_status: "MANUAL_REVIEW",
          request_manual_review: true,
          organization_id: organization.id,
          client_id: mariaClient.id,
          opportunity_id: secondOpportunity.id,
        });
        await store.createTerritoryReviewRequest({
          lead_id: mariaLead.id,
          brand_id: secondBrand.id,
          territory_search_id: search.id,
          prospect_message: "Interested in the Dallas North metro area.",
          organization_id: organization.id,
          client_id: mariaClient.id,
          opportunity_id: secondOpportunity.id,
        });
        console.log("Created territory search + review request for Maria Chen.");
      }

      await store.insertActivityEvent({
        organization_id: organization.id,
        client_id: mariaClient.id,
        opportunity_id: secondOpportunity.id,
        event_type: "opportunity_created",
        event_source: "seed",
        event_data: { brand: secondBrand.slug },
        external_event_id: `seed:second-opportunity:${mariaClient.id}`,
      });
    }
  }

  console.log("");
  console.log("Advisor backend seeded. Sign in at /advisor/login:");
  console.log("(Development-only credentials — never use in production.)");
  console.log(`  Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`  Advisor: ${advisorEmail} / ${advisorPassword}`);
  console.log(`  Advisor: ${advisor2Email} / ${advisor2Password}`);
}

main().catch((error) => {
  console.error("Advisor seed failed:", error);
  process.exit(1);
});
