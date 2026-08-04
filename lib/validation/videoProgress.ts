import { z } from "zod";

export const videoProgressSchema = z.object({
  currentTime: z.number().min(0).max(60 * 60 * 24),
  duration: z.number().min(0).max(60 * 60 * 24),
  percent: z.number().min(0).max(100),
  secondsWatched: z.number().min(0).max(60 * 60 * 24).optional(),
  eventType: z.enum(["play", "timeupdate", "pause", "ended", "heartbeat"]),
  mediaId: z.string().trim().max(100).optional(),
});

export type VideoProgressPayload = z.infer<typeof videoProgressSchema>;
