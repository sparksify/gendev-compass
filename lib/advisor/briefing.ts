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
  /** "Maria Chen" — the row leads with the person, not the task. */
  name: string;
  email: string;
  /** "Schedule follow-up — Maria Chen" */
  title: string;
  /** "Unit Economics · questionnaire completed 2 days ago, no booking" */
  detail: string;
  /** The reason clause alone, so identical ones can be summarized. */
  reason: string;
  /** Spine color: the client's discovery stage. */
  spineColor: string;
  marker: { kind: "overdue"; label: string } | { kind: "warm" } | null;
  /** Whole days overdue; null when this row isn't owed a follow-up. */
  overdueDays: number | null;
  ctaLabel: string;
  /** Pre-filled reminder, when the recommendation carries one. */
  mailto: string | null;
}

export interface WorkQueueDigest {
  /**
   * One sentence covering the whole queue, for when every row is overdue for
   * the same reason — the common case, and quicker to read than six rows
   * repeating it. Null when the queue is mixed.
   */
  summary: string | null;
  /** mailto that BCCs everyone in the queue, for the bulk nudge. */
  remindAllMailto: string | null;
}

export interface Bottleneck {
  /** "206 leads sit at Intro Call." */
  text: string;
  /** The move that clears it. */
  advice: string;
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
  /** Leads created in the last 30 days, and how many of those this week. */
  newLeads: { count: number; thisWeek: number };
  /** FDD Item 23 receipts — the signed acknowledgment coming back. */
  item23Received: { count: number; thisWeek: number };
  /** Discovery days (consultations) currently on the calendar. */
  discoveryDaysScheduled: { count: number; thisWeek: number };
  bookingRate: { per100: number | null; delta: number | null };
  videoWatch: { averagePercent: number | null; completed: number };
  followUps: { count: number; oldestDays: number | null };
  pipeline: { total: number; segments: PipelineSegment[] };
  workQueue: WorkQueueItem[];
  workQueueDigest: WorkQueueDigest;
  conversion: ConversionStep[];
  /** The stage holding the most clients back, when one clearly dominates. */
  bottleneck: Bottleneck | null;
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

    const clause = reason ? toDetailClause(reason) : action.description;

    return {
      leadId: row.lead.id,
      name: `${row.lead.first_name} ${row.lead.last_name}`,
      email: row.lead.email,
      title: `${action.title} — ${row.lead.first_name} ${row.lead.last_name}`,
      detail: [stage?.short ?? "Not a fit", clause].filter(Boolean).join(" · "),
      reason: clause,
      spineColor: stage?.color ?? SIGNAL.neutral,
      marker: row.followUp.needed
        ? { kind: "overdue" as const, label: `OVERDUE · ${Math.max(1, overdueDays)}d` }
        : { kind: "warm" as const },
      overdueDays: row.followUp.needed ? Math.max(1, overdueDays) : null,
      ctaLabel: shortCta(action.title, action.ctaLabel),
      mailto: mailtoFor(row.lead.email, action.reminder),
    };
  });
}

/**
 * Collapse the queue into one sentence when it says the same thing six times.
 * Only fires when every row is overdue for an identical reason — a mixed
 * queue gets no summary rather than a vague one that flattens the difference.
 */
function buildWorkQueueDigest(queue: WorkQueueItem[]): WorkQueueDigest {
  const emails = queue.map((item) => item.email).filter(Boolean);
  const remindAllMailto =
    emails.length > 1
      ? `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(
          "Following up on your franchise enquiry",
        )}`
      : null;

  const allOverdue = queue.length > 1 && queue.every((item) => item.overdueDays !== null);
  const reasons = new Set(queue.map((item) => item.reason));
  if (!allOverdue || reasons.size !== 1) return { summary: null, remindAllMailto };

  const days = queue.map((item) => item.overdueDays as number);
  const oldest = Math.max(...days);
  const uniform = days.every((day) => day === oldest);
  const age = `${uniform ? "" : "up to "}${oldest} day${oldest === 1 ? "" : "s"} overdue`;

  return {
    summary: `All ${queue.length} are follow-ups on ${[...reasons][0]} — ${age}.`,
    remindAllMailto,
  };
}

/** The move that clears each stage, for the bottleneck note. */
const STAGE_MOVE: Record<DiscoveryStageId, string> = {
  1: "Booking consultations",
  2: "Getting FDDs out",
  3: "Designing territories",
  4: "Confirming attendance",
  5: "Closing the agreement",
};

/**
 * The stage where the pipeline is piling up. Only reported when one stage
 * holds a clear plurality — with an even spread there is no bottleneck to
 * point at, and inventing one would send the advisor after noise.
 */
function buildBottleneck(segments: PipelineSegment[], total: number): Bottleneck | null {
  if (total === 0) return null;
  const ranked = [...segments].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  // Terminal stage is where clients are meant to end up, not a blockage.
  if (!top || top.count === 0 || top.stage.id === 5) return null;
  if (top.count / total < 0.4) return null;

  return {
    text: `${top.count} lead${top.count === 1 ? "" : "s"} sit${top.count === 1 ? "s" : ""} at ${top.stage.tiny}.`,
    advice: `${STAGE_MOVE[top.stage.id]} is this week's highest-leverage move.`,
  };
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

  const newLeads = rows.filter((row) => withinMs(row.lead.created_at, 30 * DAY_MS, now));
  const item23 = rows.filter((row) => row.lead.fdd_received_at);
  const scheduled = rows.filter((row) => row.activeAppointment !== null);

  // Built once: the digest reads the queue, and the bottleneck reads the
  // segments, so neither is recomputed inside the returned object.
  const workQueue = buildWorkQueue(rows, now);
  const segments = DISCOVERY_STAGES.map((stage) => ({
    stage,
    count: inProcess.filter((row) => discoveryStageIdFor(row.stage) === stage.id).length,
  }));

  return {
    activePipeline: { count: active.length, newThisWeek: thisWeek.length },
    newLeads: { count: newLeads.length, thisWeek: thisWeek.length },
    item23Received: {
      count: item23.length,
      thisWeek: item23.filter((row) => withinMs(row.lead.fdd_received_at, 7 * DAY_MS, now)).length,
    },
    discoveryDaysScheduled: {
      count: scheduled.length,
      thisWeek: scheduled.filter((row) =>
        withinMs(row.activeAppointment?.created_at, 7 * DAY_MS, now),
      ).length,
    },
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
      segments,
    },
    workQueue,
    workQueueDigest: buildWorkQueueDigest(workQueue),
    conversion: buildConversion(rows, now),
    bottleneck: buildBottleneck(segments, inProcess.length),
    recentActivity: buildRecentActivity(rows, now),
  };
}
