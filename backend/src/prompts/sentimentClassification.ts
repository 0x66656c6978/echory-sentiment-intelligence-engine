import type { TelemetryChunkRequest } from "@echory/contract";

/**
 * Shared prompt for the sentiment/nuance classification task — used by both
 * the ticket 0006 benchmark script and ticket 0007's real InferenceProvider,
 * so what gets benchmarked is exactly what ships (not a close approximation).
 */

export const SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT = `You are the Sentiment Intelligence Engine for a real-time B2B negotiation copilot. You analyze a single transcript chunk from a live call, combined with acoustic metadata, and detect not just surface sentiment but hidden emotional subtext.

Acoustic metadata guide (0-1 unless noted):
- pitch_volatility: 0 = monotone, 1 = extreme pitch variation (high values often signal stress, agitation, or forced enthusiasm masking true feelings)
- speech_rate_wpm: words per minute (high = rushed/anxious/evasive, low = deliberate/hesitant)
- pause_duration_ms: pause before this utterance (long pauses often signal hesitation, calculation, or reluctance)
- volume_intensity: relative loudness (high can signal aggression or emphasis; low can signal appeasement or withdrawal)

Use BOTH the words and the acoustic signals together — they often disagree, and that disagreement is itself the signal. Enthusiastic words plus high pitch volatility can indicate sarcasm or forced positivity, not genuine positivity. Calm words plus high volume or fast speech can mask aggression.

Classify into exactly one of: positive, negative, neutral, sarcastic, aggressive, deflecting, appeasement.
- sarcastic: words say one thing, tone/acoustic cues or context suggest another
- deflecting: avoiding commitment, changing subject, stalling, vague qualifiers
- aggressive: pressuring, threatening, forceful, impatient
- appeasement: over-agreeing, placating, conflict-avoidant, submissive

Respond with ONLY strict JSON, no markdown, no code fences, no commentary before or after:
{
  "sentiment": "positive" | "negative" | "neutral" | "sarcastic" | "aggressive" | "deflecting" | "appeasement",
  "confidence": number between 0 and 1,
  "volatility_flag": boolean (true if this chunk shows high emotional volatility/instability),
  "hidden_intent": string, max 60 characters, the underlying intent behind the words,
  "mitigation_suggestion": string, max 120 characters, one concrete actionable thing the negotiator should do next,
  "risk_level": "low" | "medium" | "high" | "critical"
}`;

/**
 * JSON Schema for Ollama's structured-output `format` field. Ticket 0006's
 * benchmark found that without this, a small model (llama3.2:1b) silently
 * dropped a required field (volatility_flag) from its output under this
 * prompt's full length/complexity — not an invalid-JSON problem, a missing-
 * field one. Schema enforcement fixed that structurally; it does NOT fix
 * classification quality (a separate, still-real concern) — both must be
 * evaluated, which is exactly what this benchmark does.
 */
export const SENTIMENT_CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    sentiment: {
      type: "string",
      enum: ["positive", "negative", "neutral", "sarcastic", "aggressive", "deflecting", "appeasement"],
    },
    confidence: { type: "number" },
    volatility_flag: { type: "boolean" },
    hidden_intent: { type: "string", maxLength: 60 },
    mitigation_suggestion: { type: "string", maxLength: 120 },
    risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
  },
  required: ["sentiment", "confidence", "volatility_flag", "hidden_intent", "mitigation_suggestion", "risk_level"],
} as const;

export function buildSentimentClassificationUserMessage(chunk: TelemetryChunkRequest): string {
  const { speaker, text, acoustic_metadata } = chunk;
  return `Speaker: ${speaker}
Transcript: "${text}"

Acoustic metadata:
pitch_volatility=${acoustic_metadata.pitch_volatility}
speech_rate_wpm=${acoustic_metadata.speech_rate_wpm}
pause_duration_ms=${acoustic_metadata.pause_duration_ms}
volume_intensity=${acoustic_metadata.volume_intensity}

Classify this chunk.`;
}
