import type {
  Sentiment,
  SentimentProvider,
  TelemetryChunkRequest,
  TelemetryChunkResponse,
} from "@echory/contract";

/**
 * Rule-based placeholder classifier. Behaviorally informed by
 * reference-backend/index.js (broad acoustic thresholds + a tiny generic
 * lexical signal) but reimplemented in typed TypeScript rather than ported
 * line-for-line. Deliberately approximate — this is the seam a real LLM
 * provider (local/cloud) replaces in a later phase.
 */

const GENERIC_POSITIVE = ["great", "good", "glad", "happy", "agree", "yes", "love", "excited", "thank"];
const GENERIC_NEGATIVE = ["no", "not", "never", "unacceptable", "concern", "problem", "wrong", "disappoint", "bad"];

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function countHits(lower: string, words: string[]): number {
  return words.reduce((count, word) => (lower.includes(word) ? count + 1 : count), 0);
}

type PlaceholderResult = Omit<TelemetryChunkResponse, "chunk_id" | "processing_latency_ms">;

const HIDDEN_INTENTS: Record<Sentiment, string> = {
  positive: "agreement_signal",
  negative: "dissatisfaction_signal",
  neutral: "informational",
  sarcastic: "veiled_disagreement",
  aggressive: "high_arousal_pressure",
  deflecting: "avoidance_signal",
  appeasement: "conflict_avoidance",
};

const MITIGATIONS: Record<Sentiment, string> = {
  positive: "Reinforce alignment and propose a concrete next step",
  negative: "Validate the objection explicitly before responding",
  neutral: "Ask an open-ended question to surface intent",
  sarcastic: "Name the tension directly and invite a straight answer",
  aggressive: "De-escalate, acknowledge the concern, slow the pace",
  deflecting: "Gently redirect back to the original question with a deadline",
  appeasement: "Probe for the underlying concern behind the agreement",
};

export class PlaceholderProvider implements SentimentProvider {
  readonly name = "placeholder";

  async analyze(chunk: TelemetryChunkRequest): Promise<PlaceholderResult> {
    const lower = chunk.text.toLowerCase();
    const { pitch_volatility: pitch, speech_rate_wpm: wpm } = chunk.acoustic_metadata;

    const isVolatile = pitch > 0.65 || wpm > 190;
    const posHits = countHits(lower, GENERIC_POSITIVE);
    const negHits = countHits(lower, GENERIC_NEGATIVE);

    let sentiment: Sentiment = "neutral";
    if (pitch > 0.8 && wpm > 180) {
      sentiment = "aggressive";
    } else if (negHits > posHits && pitch > 0.45) {
      sentiment = "negative";
    } else if (posHits > negHits) {
      sentiment = "positive";
    } else if (pitch > 0.55) {
      sentiment = "negative";
    }

    const riskLevel =
      sentiment === "aggressive"
        ? isVolatile
          ? "critical"
          : "high"
        : sentiment === "negative"
          ? isVolatile
            ? "high"
            : "medium"
          : sentiment === "positive"
            ? "low"
            : isVolatile
              ? "medium"
              : "low";

    const lexicalMargin = Math.abs(posHits - negHits);
    const confidence = clamp(0.5 + 0.1 * lexicalMargin + 0.25 * Math.abs(pitch - 0.5), 0.5, 0.95);

    return {
      sentiment,
      confidence: Math.round(confidence * 100) / 100,
      volatility_flag: isVolatile,
      hidden_intent: HIDDEN_INTENTS[sentiment],
      mitigation_suggestion: MITIGATIONS[sentiment],
      risk_level: riskLevel,
    };
  }
}
