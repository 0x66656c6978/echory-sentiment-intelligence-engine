/**
 * @echory/contract
 * ================
 * Single source of truth for the `POST /api/telemetry/stream` and session-summary
 * API contract, shared between `backend` and `frontend`. Neither package should
 * redeclare these shapes locally — import from here so the two can be built in
 * parallel without drifting apart.
 *
 * Source of truth for field names/enums/limits: docs/CHALLENGE.md.
 */

import { z } from "zod";

// ─── Shared endpoint paths / defaults ────────────────────────────────────────

export const DEFAULT_PORT = 3000;
export const API_TELEMETRY_STREAM_PATH = "/api/telemetry/stream";
export const API_SESSION_SUMMARY_PATH = (sessionId: string) =>
  `/api/telemetry/session/${sessionId}/summary`;
export const WS_TELEMETRY_PATH = "/ws/telemetry";

// ─── Request ──────────────────────────────────────────────────────────────────

export const SpeakerSchema = z.enum(["candidate", "counterpart"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const AcousticMetadataSchema = z.object({
  pitch_volatility: z.number().min(0).max(1),
  speech_rate_wpm: z.number().nonnegative(),
  pause_duration_ms: z.number().nonnegative(),
  volume_intensity: z.number().min(0).max(1),
});
export type AcousticMetadata = z.infer<typeof AcousticMetadataSchema>;

export const TelemetryChunkRequestSchema = z.object({
  chunk_id: z.string().min(1),
  session_id: z.string().min(1),
  timestamp_ms: z.number(),
  speaker: SpeakerSchema,
  text: z.string(),
  acoustic_metadata: AcousticMetadataSchema,
});
export type TelemetryChunkRequest = z.infer<typeof TelemetryChunkRequestSchema>;

// ─── Response ─────────────────────────────────────────────────────────────────

export const SentimentSchema = z.enum([
  "positive",
  "negative",
  "neutral",
  "sarcastic",
  "aggressive",
  "deflecting",
  "appeasement",
]);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const TelemetryChunkResponseSchema = z.object({
  chunk_id: z.string().min(1),
  processing_latency_ms: z.number().nonnegative(),
  sentiment: SentimentSchema,
  confidence: z.number().min(0).max(1),
  volatility_flag: z.boolean(),
  hidden_intent: z.string().max(60),
  mitigation_suggestion: z.string().max(120),
  risk_level: RiskLevelSchema,
});
export type TelemetryChunkResponse = z.infer<typeof TelemetryChunkResponseSchema>;

// ─── Session summary (Track B contract; included for completeness) ──────────

export const RiskMomentSchema = z.object({
  chunk_id: z.string(),
  timestamp_ms: z.number(),
  sentiment: SentimentSchema,
  risk_level: RiskLevelSchema,
  text_excerpt: z.string(),
});
export type RiskMoment = z.infer<typeof RiskMomentSchema>;

export const SessionSummaryResponseSchema = z.object({
  session_id: z.string(),
  chunk_count: z.number().int().nonnegative(),
  aggregated_volatility_score: z.number().min(0).max(1),
  dominant_sentiment: SentimentSchema,
  top_risk_moments: z.array(RiskMomentSchema).max(3),
});
export type SessionSummaryResponse = z.infer<typeof SessionSummaryResponseSchema>;

// ─── LLM provider seam (Phase 3 implements local + cloud against this) ──────

export interface SentimentProvider {
  readonly name: string;
  analyze(chunk: TelemetryChunkRequest): Promise<Omit<TelemetryChunkResponse, "chunk_id" | "processing_latency_ms">>;
}
