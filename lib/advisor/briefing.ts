import { deriveNextBestAction } from "./nextBestAction";
import {
  DISCOVERY_STAGES,
  discoveryStageIdFor,
  SIGNAL,
  type DiscoveryStage,
  type DiscoveryStageId,
} from "./discoveryStages";
import type { InvestorRow } from "./investors";

/**
 * The daily briefing shown on /advisor, derived entirely from the rows the
 * clients list already loads. Nothing here is stored or invented: every
 * number traces back to a timestamp on the lead, the questionnaire, the
 * video progress row, or an appointment.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function since(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const ms = now.getTime() - new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function withinMs(iso: string | null | undefined, ms: number, now: Date): boolean {
  const age = since(iso, now);
  return age !== null && age >= 0 && age <= ms;
}

function daysAgo(iso: string | null | undefined, now: Date): number {
  const age = since(iso, now) ?? 0;
  return Math.max(0, Math.floor(age / DAY_MS));
}

export interface PipelineSegment {
  stage: DiscoveryStage;
  count: number;
}

export interface WorkQueueItem {
  leadId: string;
  /** "Schedule follow-up — Maria Chen" */
  title: string;
  /** "Unit Economics · questionnaire completed 2 days ago, no booking" */
  detail: string;
  /** Spine color: the client's discovery stage. */
  spineColor: string;
  marker: { kind: "overdue"; label: string } | { kind: "warm" } | null;
  ctaLabel: string;
  /** Pre-filled reminder, when the recommendation carries one. */
  mailto: string | null;
}

export interface ConversionStep {
  from: DiscoveryStage;
  to: DiscoveryStage;
  /** Null when nobody has reached the "from" stage in the window. */
  percent: number | null;
}

export interface ActivityItem {
  leadId: string;
  name: string;
  /** Everything after the name: "completed the questionnaire". */
  text: string;
  color: string;
  at: string;
}

export interface Briefing {
  activePipeline: { count: number; newThisWeek: number };
  bookingRate: { per100: number | null; delta: number | null };
  videoWatch: { averagePercent: number | null; completed: number };
  followUps: { count: number; oldestDays: number | null };
  pipeline: { total: number; segments: PipelineSegment[] };
  workQueue: WorkQueueItem[];
  conversion: ConversionStep[];
  recentActivity: ActivityItem[];
}

/** "Questionnaire completed 2 days ago; no consultation booked." → lower, unpunctuated. */
function toDetailClause(reason: string): string {
  const trimmed = reason.trim().replace(/[.;]+$/, "").replace(/;\s*/g, ", ");
  // Leave acronyms alone — "FDD sent 2 days ago", never "fDD".
  const isAcronym = /^[A-Z]{2,}/.test(trimmed);
  return isAcronym ? trimmed : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** The design's one-word CTAs, derived from the recommendation itself. */
function shortCta(title: string, ctaLabel: string): string {
  if (ctaLabel === "Call Candidate") return "Call";
  if (/rebook/i.test(title)) return "Rebook";
  return "Remind";
}

function mailtoFor(email: string, reminder: { subject: string; body: string } | null): string | null {
  if (!reminder) return null;
  return `mailto:${email}?subject=${encodeURIComponent(reminder.subject)}&body=${encodeURIComponent(reminder.body)}`;
}

function buildWorkQueue(rows: InvestorRow[], now: Date): WorkQueueItem[] {
  const flagged = rows.filter((row) => row.followUp.needed);
  // Warm = no follow-up owed, but they did something in the last 24 hours.
  const warm = rows.filter(
    (row) => !row.followUp.needed && withinMs(row.lastActivityAt, DAY_MS, now),
  );

  const ordered = [
    ...flagged.sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt)),
    ...warm.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
  ].slice(0, 6);

  return ordered.map((row) => {
    const action = deriveNextBestAction(
      row.lead,
      row.questionnaire,
      row.video,
      row.appointments,
      [],
      0,
      now,
    );
    const stageId = discoveryStageIdFor(row.stage);
    const stage = stageId ? DISCOVERY_STAGES[stageId - 1] : null;
    const reason = row.followUp.reasons[0];
    const overdueDays = daysAgo(row.lastActivityAt, now);

    return {
      leadId: row.lead.id,
      title: `${action.title} — ${row.lead.first_name} ${row.lead.last_name}`,
      detail: [stage?.short ?? "Not a fit", reason ? toDetailClause(reason) : action.description]
        .filter(Boolean)
        .join(" · "),
      spineColor: stage?.color ?? SIGNAL.neutral,
      marker: row.followUp.needed
        ? { kind: "overdue" as const, label: `OVERDUE · ${Math.max(1, overdueDays)}D` }
        : { kind: "warm" as const },
      ctaLabel: shortCta(action.title, action.ctaLabel),
      mailto: mailtoFor(row.lead.email, action.reminder),
    };
  });
}

/**
 * Stage-to-stage conversion over the last 30 days of clients: of everyone who
 * ever reached stage N, how many are now at N+1 or beyond. Uses the current
 * stage as the high-water mark, which is how the pipeline actually moves —
 * automation only ever advances it.
 */
function buildConversion(rows: InvestorRow[], now: Date): ConversionStep[] {
  const window = rows.filter((row) => withinMs(row.lead.created_at, 30 * DAY_MS, now));
  const pool = window.length > 0 ? window : rows;
  const reached = new Map<DiscoveryStageId, number>();
  for (const stage of DISCOVERY_STAGES) {
    reached.set(
      stage.id,
      pool.filter((row) => {
        const id = discoveryStageIdFor(row.stage);
        return id !== null && id >= stage.id;
      }).length,
    );
  }

  return DISCOVERY_STAGES.slice(0, -1).map((from, index) => {
    const to = DISCOVERY_STAGES[index + 1];
    const base = reached.get(from.id) ?? 0;
    const next = reached.get(to.id) ?? 0;
    return { from, to, percent: base > 0 ? Math.round((next / base) * 100) : null };
  });
}

/**
 * The last 24 hours, assembled from the timestamps already on each row —
 * there is no global event feed to read, and these are the same moments the
 * per-client activity list shows.
 */
function buildRecentActivity(rows: InvestorRow[], now: Date): ActivityItem[] {
  const items: ActivityItem[] = [];
  const push = (row: InvestorRow, at: string | null | undefined, text: string, color: string) => {
    if (!withinMs(at, DAY_MS, now)) return;
    items.push({
      leadId: row.lead.id,
      name: `${row.lead.first_name} ${row.lead.last_name}`,
      text,
      color,
      at: at as string,
    });
  };

  for (const row of rows) {
    push(row, row.lead.questionnaire_completed_at, "completed the questionnaire", SIGNAL.success);
    push(row, row.lead.fdd_requested_at, "requested the FDD", DISCOVERY_STAGES[2].color);
    push(row, row.lead.booked_at, "booked a consultation", DISCOVERY_STAGES[1].color);
    push(row, row.lead.portal_first_opened_at, "opened the portal", DISCOVERY_STAGES[0].color);
    const cancelled = row.appointments.find((a) => a.status === "CANCELLED");
    if (cancelled) push(row, cancelled.updated_at, "cancelled their consultation", SIGNAL.alert);
    if (row.video && row.video.highest_percent_watched > 0) {
      push(
        row,
        row.video.last_event_at,
        row.video.completed
          ? "finished the overview video"
          : `watched ${Math.round(row.video.highest_percent_watched)}% of the overview`,
        DISCOVERY_STAGES[0].color,
      );
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
}

/** Bookings per 100 portal visitors for one cohort of leads. */
function bookingRateFor(rows: InvestorRow[]): number | null {
  const visitors = rows.filter((row) => row.lead.portal_first_opened_at).length;
  if (visitors === 0) return null;
  const booked = rows.filter((row) => row.lead.booked_at || row.appointments.length > 0).length;
  return Math.round((booked / visitors) * 1000) / 10;
}

export function buildBriefing(rows: InvestorRow[], now: Date = new Date()): Briefing {
  const active = rows.filter((row) => row.stage !== "NOT_A_FIT" && row.stage !== "CLOSED_INVESTED");
  const inProcess = rows.filter((row) => discoveryStageIdFor(row.stage) !== null);

  const withVideo = rows.filter((row) => row.video && row.video.highest_percent_watched > 0);
  const averagePercent =
    withVideo.length > 0
      ? Math.round(
          withVideo.reduce((sum, row) => sum + (row.video?.highest_percent_watched ?? 0), 0) /
            withVideo.length,
        )
      : null;

  const flagged = rows.filter((row) => row.followUp.needed);
  const oldestFlagged = flagged
    .map((row) => row.lastActivityAt)
    .sort((a, b) => a.localeCompare(b))[0];

  const thisWeek = rows.filter((row) => withinMs(row.lead.created_at, 7 * DAY_MS, now));
  const lastWeek = rows.filter((row) => {
    const age = since(row.lead.created_at, now);
    return age !== null && age > 7 * DAY_MS && age <= 14 * DAY_MS;
  });
  const per100 = bookingRateFor(rows);
  const thisWeekRate = bookingRateFor(thisWeek);
  const lastWeekRate = bookingRateFor(lastWeek);

  return {
    activePipeline: { count: active.length, newThisWeek: thisWeek.length },
    bookingRate: {
      per100,
      delta:
        thisWeekRate !== null && lastWeekRate !== null
          ? Math.round((thisWeekRate - lastWeekRate) * 10) / 10
          : null,
    },
    videoWatch: {
      averagePercent,
      completed: rows.filter((row) => row.video?.completed).length,
    },
    followUps: {
      count: flagged.length,
      oldestDays: oldestFlagged ? daysAgo(oldestFlagged, now) : null,
    },
    pipeline: {
      total: inProcess.length,
      segments: DISCOVERY_STAGES.map((stage) => ({
        stage,
        count: inProcess.filter((row) => discoveryStageIdFor(row.stage) === stage.id).length,
      })),
    },
    workQueue: buildWorkQueue(rows, now),
    conversion: buildConversion(rows, now),
    recentActivity: buildRecentActivity(rows, now),
  };
}
