import type { Sentiment, RiskLevel, TelemetryChunkRequest } from "@echory/contract";

export interface BenchmarkCase {
  id: string;
  chunk: TelemetryChunkRequest;
  expected: {
    sentiment: Sentiment;
    /** Alternate sentiments accepted as correct for genuinely ambiguous cases. */
    acceptableSentiments?: Sentiment[];
    risk_level: RiskLevel;
    volatility_flag?: boolean; // omitted where the "right" answer is genuinely ambiguous
  };
  /** Why this case is labeled this way — read by a human reviewer, and given to the judge model as ground truth. */
  rationale: string;
}

function chunk(overrides: Omit<TelemetryChunkRequest, "chunk_id" | "session_id" | "timestamp_ms">): TelemetryChunkRequest {
  return {
    chunk_id: "bench",
    session_id: "bench",
    timestamp_ms: Date.now(),
    ...overrides,
  };
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "clear_positive",
    chunk: chunk({
      speaker: "counterpart",
      text: "Great, I think we have a deal. Let's move forward with these terms.",
      acoustic_metadata: { pitch_volatility: 0.15, speech_rate_wpm: 130, pause_duration_ms: 50, volume_intensity: 0.45 },
    }),
    expected: { sentiment: "positive", risk_level: "low", volatility_flag: false },
    rationale: "Unambiguous genuine agreement, calm delivery matches the words.",
  },
  {
    id: "positive_with_excitement",
    chunk: chunk({
      speaker: "counterpart",
      text: "This is fantastic news! I can't believe we finally got here!",
      acoustic_metadata: { pitch_volatility: 0.55, speech_rate_wpm: 175, pause_duration_ms: 80, volume_intensity: 0.7 },
    }),
    expected: { sentiment: "positive", risk_level: "low" },
    rationale: "Genuine excitement, not forced — acoustic arousal matches enthusiastic words, not a contradiction signal. volatility_flag is a judgment call either way, not graded.",
  },
  {
    id: "clear_negative",
    chunk: chunk({
      speaker: "counterpart",
      text: "No, this is completely unacceptable. We cannot agree to these terms.",
      acoustic_metadata: { pitch_volatility: 0.4, speech_rate_wpm: 150, pause_duration_ms: 100, volume_intensity: 0.6 },
    }),
    expected: { sentiment: "negative", risk_level: "medium" },
    rationale: "Direct, unambiguous rejection.",
  },
  {
    id: "clear_neutral",
    chunk: chunk({
      speaker: "candidate",
      text: "Let's go over the shipping timeline for section 4 of the contract.",
      acoustic_metadata: { pitch_volatility: 0.1, speech_rate_wpm: 120, pause_duration_ms: 200, volume_intensity: 0.4 },
    }),
    expected: { sentiment: "neutral", risk_level: "low", volatility_flag: false },
    rationale: "Purely informational, no emotional signal either way.",
  },
  {
    id: "neutral_fast_talker",
    chunk: chunk({
      speaker: "candidate",
      text: "Right, so moving on, next item is the delivery schedule for Q3.",
      acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 210, pause_duration_ms: 30, volume_intensity: 0.5 },
    }),
    expected: { sentiment: "neutral", risk_level: "low" },
    rationale: "Naturally quick-talking, businesslike — fast speech alone isn't volatility. Tests over-triggering on speech_rate_wpm alone.",
  },
  {
    id: "classic_sarcasm",
    chunk: chunk({
      speaker: "counterpart",
      text: "Oh sure, because that's worked out SO well for us before.",
      acoustic_metadata: { pitch_volatility: 0.75, speech_rate_wpm: 160, pause_duration_ms: 150, volume_intensity: 0.55 },
    }),
    expected: { sentiment: "sarcastic", risk_level: "high" },
    rationale: "Overt verbal irony ('SO well') plus high pitch volatility reinforcing the mocking tone.",
  },
  {
    id: "sarcasm_masked_as_commitment",
    chunk: chunk({
      speaker: "counterpart",
      text: "Yes, we are absolutely committed to the partnership — though naturally our legal team will need to review every single line.",
      acoustic_metadata: { pitch_volatility: 0.82, speech_rate_wpm: 187, pause_duration_ms: 340, volume_intensity: 0.61 },
    }),
    expected: { sentiment: "sarcastic", risk_level: "high" },
    rationale: "This is docs/CHALLENGE.md's own worked example (deflection_via_legal_delay, high risk) — included as a direct sanity check against the spec's stated expectation.",
  },
  {
    id: "deflecting_classic",
    chunk: chunk({
      speaker: "counterpart",
      text: "That's a great question — let me circle back to my team and get you a proper answer next week.",
      acoustic_metadata: { pitch_volatility: 0.3, speech_rate_wpm: 140, pause_duration_ms: 450, volume_intensity: 0.4 },
    }),
    expected: { sentiment: "deflecting", risk_level: "medium" },
    rationale: "Classic stalling pattern: praise the question, then postpone indefinitely. Long pause reinforces reluctance.",
  },
  {
    id: "deflecting_subtle",
    chunk: chunk({
      speaker: "counterpart",
      text: "Well, there are a lot of factors to consider here, it's complicated, we'll see.",
      acoustic_metadata: { pitch_volatility: 0.35, speech_rate_wpm: 100, pause_duration_ms: 600, volume_intensity: 0.35 },
    }),
    expected: { sentiment: "deflecting", risk_level: "medium" },
    rationale: "Vague qualifiers ('a lot of factors', 'we'll see') with no commitment, plus a very long pause.",
  },
  {
    id: "aggressive_overt",
    chunk: chunk({
      speaker: "counterpart",
      text: "You need to sign this today or the deal is off the table, no more delays.",
      acoustic_metadata: { pitch_volatility: 0.7, speech_rate_wpm: 195, pause_duration_ms: 20, volume_intensity: 0.85 },
    }),
    expected: { sentiment: "aggressive", risk_level: "critical", volatility_flag: true },
    rationale: "Explicit ultimatum/threat, loud and fast — textbook aggressive pressure tactic.",
  },
  {
    id: "aggressive_low_patience",
    chunk: chunk({
      speaker: "counterpart",
      text: "I've explained this three times already. What part is unclear to you?",
      acoustic_metadata: { pitch_volatility: 0.5, speech_rate_wpm: 170, pause_duration_ms: 40, volume_intensity: 0.75 },
    }),
    expected: { sentiment: "aggressive", risk_level: "high" },
    rationale: "Condescending impatience rather than an overt threat — subtler aggression.",
  },
  {
    id: "appeasement_overagree",
    chunk: chunk({
      speaker: "candidate",
      text: "Of course, whatever works best for you, we're happy to adjust on our end again.",
      acoustic_metadata: { pitch_volatility: 0.25, speech_rate_wpm: 145, pause_duration_ms: 90, volume_intensity: 0.3 },
    }),
    expected: { sentiment: "appeasement", risk_level: "medium" },
    rationale: "Repeated over-accommodation ('again') signals a one-sided pattern of concessions.",
  },
  {
    id: "appeasement_submissive",
    chunk: chunk({
      speaker: "candidate",
      text: "I don't want to cause any issues, so if you think that's best, let's just go with it.",
      acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 110, pause_duration_ms: 250, volume_intensity: 0.25 },
    }),
    expected: { sentiment: "appeasement", risk_level: "medium" },
    rationale: "Explicit conflict-avoidance ('don't want to cause any issues'), low volume/energy reinforcing submissiveness.",
  },
  {
    id: "contradiction_calm_words_loud_acoustic",
    chunk: chunk({
      speaker: "counterpart",
      text: "Sure, that sounds fine to me.",
      acoustic_metadata: { pitch_volatility: 0.65, speech_rate_wpm: 200, pause_duration_ms: 10, volume_intensity: 0.8 },
    }),
    expected: { sentiment: "sarcastic", acceptableSentiments: ["sarcastic", "aggressive"], risk_level: "high" },
    rationale: "Genuinely hard case: mundane agreement words contradicted by loud, fast, volatile delivery — could read as forced/sarcastic agreement or barely-contained aggression. Either is defensible; plain 'positive' is not.",
  },
  {
    id: "contradiction_negative_words_calm_acoustic",
    chunk: chunk({
      speaker: "counterpart",
      text: "I really don't think this proposal works for us at all.",
      acoustic_metadata: { pitch_volatility: 0.15, speech_rate_wpm: 110, pause_duration_ms: 300, volume_intensity: 0.35 },
    }),
    expected: { sentiment: "negative", risk_level: "medium" },
    rationale: "Firm rejection delivered calmly and deliberately — tests that calm delivery doesn't get misread as low-risk agreement.",
  },
  {
    id: "genuine_hesitation",
    chunk: chunk({
      speaker: "candidate",
      text: "Hmm, I'm not sure... give me a moment to think about this.",
      acoustic_metadata: { pitch_volatility: 0.3, speech_rate_wpm: 90, pause_duration_ms: 800, volume_intensity: 0.3 },
    }),
    expected: { sentiment: "neutral", acceptableSentiments: ["neutral", "deflecting"], risk_level: "low" },
    rationale: "Honest uncertainty vs. deflection is a genuinely hard distinction — this is asking for real time, not avoiding the topic, but a model reading it as mild deflection is defensible.",
  },
  {
    id: "high_volatility_shock",
    chunk: chunk({
      speaker: "counterpart",
      text: "Wait — what? No, that's not — I need a minute.",
      acoustic_metadata: { pitch_volatility: 0.95, speech_rate_wpm: 220, pause_duration_ms: 15, volume_intensity: 0.9 },
    }),
    expected: { sentiment: "negative", acceptableSentiments: ["negative", "aggressive"], risk_level: "critical", volatility_flag: true },
    rationale: "Extreme acoustic values across the board — unambiguous case for volatility_flag=true regardless of exact sentiment label. Shock/distress reaction to unexpected news.",
  },
  {
    id: "appeasement_masking_frustration",
    chunk: chunk({
      speaker: "candidate",
      text: "No no, it's totally fine, don't worry about it, we'll figure something out.",
      acoustic_metadata: { pitch_volatility: 0.6, speech_rate_wpm: 180, pause_duration_ms: 50, volume_intensity: 0.65 },
    }),
    expected: { sentiment: "appeasement", acceptableSentiments: ["appeasement", "sarcastic"], risk_level: "high" },
    rationale: "Surface placation ('totally fine') undercut by elevated pitch/pace/volume suggesting real frustration underneath — a model catching either the appeasement pattern or the sarcastic undertone demonstrates real nuance detection.",
  },
];
