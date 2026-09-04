import type {
  MitigationFeedbackAction,
  RiskLevel,
  RiskMoment,
  Sentiment,
  SessionSummaryResponse,
  TelemetryChunkResponse,
} from "@echory/contract";

interface StoredChunk extends TelemetryChunkResponse {
  timestamp_ms: number;
  /** Original transcript text for this chunk -- needed for the summary endpoint's text_excerpt, not returned by the per-chunk response itself. */
  text: string;
  /** Whether the negotiator acted on this chunk's mitigation_suggestion -- unset until the dashboard reports feedback. Not part of the Track B summary contract, dashboard-only. */
  mitigationFeedback?: MitigationFeedbackAction;
}

const TEXT_EXCERPT_MAX_LENGTH = 100;

const RISK_SEVERITY: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * In-memory session store keyed by session_id. Each session's chunk list is
 * isolated in its own array — sessions never share or mutate each other's
 * state, which matters once multiple concurrent calls are being processed
 * (verified under real concurrency in ticket 0008).
 */
class SessionStore {
  private readonly sessions = new Map<string, StoredChunk[]>();

  append(sessionId: string, chunk: TelemetryChunkResponse, timestampMs: number, text: string): void {
    const existing = this.sessions.get(sessionId);
    const entry: StoredChunk = { ...chunk, timestamp_ms: timestampMs, text };
    if (existing) {
      existing.push(entry);
    } else {
      this.sessions.set(sessionId, [entry]);
    }
  }

  get(sessionId: string): StoredChunk[] | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Records whether the negotiator acted on a specific chunk's mitigation
   * suggestion. Returns false (route turns this into 404) when the session
   * or the chunk within it doesn't exist -- feedback can only ever attach to
   * a chunk that was actually returned to the client.
   */
  recordMitigationFeedback(sessionId: string, chunkId: string, action: MitigationFeedbackAction): boolean {
    const chunk = this.sessions.get(sessionId)?.find((c) => c.chunk_id === chunkId);
    if (!chunk) return false;
    chunk.mitigationFeedback = action;
    return true;
  }

  /**
   * Aggregates a session's stored chunks into the Track B summary shape.
   * Returns undefined for a session that was never appended to (the route
   * turns this into 404, not an empty-but-200 summary).
   *
   * - dominant_sentiment: mode of `sentiment` across the session; ties break
   *   to whichever sentiment was seen first (Map iteration order), same rule
   *   the frontend's AggregateTiles.tsx already uses for its own dominant-
   *   tone tile -- kept identical rather than inventing a second definition
   *   for the same concept.
   * - aggregated_volatility_score: share of chunks with volatility_flag
   *   true, not a risk-weighted mean -- the simpler, more defensible
   *   definition (a product judgement, not model output; see
   *   frontend/src/components/AggregateTiles.tsx's comment for the same
   *   reasoning applied client-side).
   * - top_risk_moments: highest risk_level first, ties broken by recency
   *   (most recent first) since a negotiator reviewing a session cares more
   *   about how it currently stands than which identical-severity moment
   *   happened first.
   */
  summarize(sessionId: string): SessionSummaryResponse | undefined {
    const chunks = this.sessions.get(sessionId);
    if (!chunks || chunks.length === 0) return undefined;

    const sentimentCounts = new Map<Sentiment, number>();
    let volatileCount = 0;
    for (const chunk of chunks) {
      sentimentCounts.set(chunk.sentiment, (sentimentCounts.get(chunk.sentiment) ?? 0) + 1);
      if (chunk.volatility_flag) volatileCount += 1;
    }
    const dominantSentiment = [...sentimentCounts.entries()].reduce((best, current) =>
      current[1] > best[1] ? current : best,
    )[0];

    const topRiskMoments: RiskMoment[] = [...chunks]
      .sort((a, b) => {
        const severityDiff = RISK_SEVERITY[b.risk_level] - RISK_SEVERITY[a.risk_level];
        return severityDiff !== 0 ? severityDiff : b.timestamp_ms - a.timestamp_ms;
      })
      .slice(0, 3)
      .map((chunk) => ({
        chunk_id: chunk.chunk_id,
        timestamp_ms: chunk.timestamp_ms,
        sentiment: chunk.sentiment,
        risk_level: chunk.risk_level,
        text_excerpt: truncate(chunk.text, TEXT_EXCERPT_MAX_LENGTH),
      }));

    return {
      session_id: sessionId,
      chunk_count: chunks.length,
      aggregated_volatility_score: Math.round((volatileCount / chunks.length) * 100) / 100,
      dominant_sentiment: dominantSentiment,
      top_risk_moments: topRiskMoments,
    };
  }
}

export const sessionStore = new SessionStore();
