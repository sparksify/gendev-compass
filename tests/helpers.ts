import type { LeadRecord } from "@/types/lead";
import type { AppointmentRecord } from "@/types/advisor";
import type { VideoProgressRecord } from "@/types/portal";

let counter = 0;

export function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `lead-${counter}`,
    portal_token: `token-${counter}-0123456789abcdef`,
    first_name: "Test",
    last_name: `Investor${counter}`,
    email: `investor${counter}@example.test`,
    phone: "+15550000000",
    state: "Texas",
    source: "test",
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
    status: "created",
    current_stage: "NEW_LEAD",
    assigned_advisor_id: null,
    last_activity_at: now,
    qualification_score: null,
    qualification_result: null,
    qualification_reasons: null,
    created_at: now,
    updated_at: now,
    portal_first_opened_at: null,
    video_started_at: null,
    video_completed_at: null,
    questionnaire_started_at: null,
    questionnaire_completed_at: null,
    qualified_at: null,
    calendar_viewed_at: null,
    booked_at: null,
    appointment_id: null,
    appointment_start_at: null,
    fdd_status: "not_requested",
    fdd_requested_at: null,
    fdd_sent_at: null,
    fdd_delivered_at: null,
    fdd_received_at: null,
    fdd_eligible_at: null,
    fdd_provider_envelope_id: null,
    fdd_workflow_id: null,
    fdd_request_source: null,
    fdd_last_error: null,
    fdd_retry_count: 0,
    organization_id: null,
    client_id: null,
    primary_opportunity_id: null,
    brand_id: null,
    first_utm_source: null,
    first_utm_medium: null,
    first_utm_campaign: null,
    first_utm_content: null,
    first_utm_term: null,
    first_fbclid: null,
    first_gclid: null,
    first_msclkid: null,
    first_fbp: null,
    first_fbc: null,
    first_referrer: null,
    first_landing_page: null,
    first_touch_at: null,
    last_utm_source: null,
    last_utm_medium: null,
    last_utm_campaign: null,
    last_utm_content: null,
    last_utm_term: null,
    last_fbclid: null,
    last_referrer: null,
    last_landing_page: null,
    last_touch_at: null,
    facebook_campaign_id: null,
    facebook_adset_id: null,
    facebook_ad_id: null,
    facebook_form_id: null,
    facebook_page_id: null,
    advisor_presented: null,
    advisor_selected: null,
    advisor_booked: null,
    overflow_used: false,
    ...overrides,
  };
}

export function makeAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `appt-${counter}`,
    lead_id: "lead-1",
    advisor_id: null,
    external_appointment_id: null,
    scheduled_start: null,
    scheduled_end: null,
    time_zone: null,
    status: "SCHEDULED",
    booking_url: null,
    created_at: now,
    updated_at: now,
    organization_id: null,
    client_id: null,
    opportunity_id: null,
    advisor_profile_id: null,
    ...overrides,
  };
}

export function makeVideo(overrides: Partial<VideoProgressRecord> = {}): VideoProgressRecord {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `video-${counter}`,
    lead_id: "lead-1",
    wistia_media_id: "abc",
    highest_percent_watched: 0,
    accumulated_seconds_watched: 0,
    last_playhead_position: 0,
    started: false,
    completed: false,
    play_count: 0,
    first_played_at: null,
    last_event_at: null,
    created_at: now,
    updated_at: now,
    organization_id: null,
    client_id: null,
    opportunity_id: null,
    brand_id: null,
    ...overrides,
  };
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
