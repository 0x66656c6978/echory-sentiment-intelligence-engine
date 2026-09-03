import type { BenchmarkCase } from "./benchmark-test-set.js";

/**
 * Independent holdout set — written to check whether prompt v2's improvement
 * (measured on benchmark-test-set.ts, the same 18 cases used to diagnose the
 * failures v2 targets) actually generalizes, or whether it's partly
 * overfitting to that specific set. Deliberately: different negotiation
 * contexts (pricing/timeline/finance sign-off rather than the "partnership"
 * theme running through the original set), different phrasing, different
 * acoustic value combinations. Designed from the base category definitions
 * (docs/CHALLENGE.md), not reverse-engineered from v1/v2's specific failures.
 */

function chunk(overrides: Omit<BenchmarkCase["chunk"], "chunk_id" | "session_id" | "timestamp_ms">): BenchmarkCase["chunk"] {
  return {
    chunk_id: "holdout",
    session_id: "holdout",
    timestamp_ms: Date.now(),
    ...overrides,
  };
}

export const HOLDOUT_CASES: BenchmarkCase[] = [
  {
    id: "holdout_positive_genuine",
    chunk: chunk({
      speaker: "counterpart",
      text: "Perfect, let's get the paperwork moving.",
      acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 135, pause_duration_ms: 60, volume_intensity: 0.5 },
    }),
    expected: { sentiment: "positive", risk_level: "low", volatility_flag: false },
    rationale: "Straightforward genuine agreement, calm delivery matches the words.",
  },
  {
    id: "holdout_negative_calm_firm",
    chunk: chunk({
      speaker: "counterpart",
      text: "We can't go below our current offer, that's final.",
      acoustic_metadata: { pitch_volatility: 0.18, speech_rate_wpm: 105, pause_duration_ms: 250, volume_intensity: 0.45 },
    }),
    expected: { sentiment: "negative", risk_level: "medium" },
    rationale: "Firm rejection stated calmly, no hostility present -- should not be read as aggressive.",
  },
  {
    id: "holdout_neutral_admin",
    chunk: chunk({
      speaker: "candidate",
      text: "Let's confirm the delivery address before we finalize the contract.",
      acoustic_metadata: { pitch_volatility: 0.12, speech_rate_wpm: 118, pause_duration_ms: 150, volume_intensity: 0.4 },
    }),
    expected: { sentiment: "neutral", risk_level: "low", volatility_flag: false },
    rationale: "Purely administrative, no emotional signal.",
  },
  {
    id: "holdout_sarcasm_verbal_irony",
    chunk: chunk({
      speaker: "counterpart",
      text: "Wow, another 'final' offer. I'm sure this one really is the last.",
      acoustic_metadata: { pitch_volatility: 0.68, speech_rate_wpm: 155, pause_duration_ms: 120, volume_intensity: 0.5 },
    }),
    expected: { sentiment: "sarcastic", risk_level: "high" },
    rationale: "Overt verbal irony via scare-quoted repetition ('final'... 'really is the last').",
  },
  {
    id: "holdout_sarcasm_acoustic_contradiction",
    chunk: chunk({
      speaker: "counterpart",
      text: "Take all the time you need, no rush at all.",
      acoustic_metadata: { pitch_volatility: 0.72, speech_rate_wpm: 195, pause_duration_ms: 20, volume_intensity: 0.68 },
    }),
    expected: { sentiment: "sarcastic", acceptableSentiments: ["sarcastic", "aggressive"], risk_level: "high" },
    rationale: "Reassuring, patient words directly contradicted by fast/tense/loud delivery -- classic acoustic-contradiction case, different phrasing from the original set's version.",
  },
  {
    id: "holdout_deflecting_finance_signoff",
    chunk: chunk({
      speaker: "counterpart",
      text: "Before I commit to a number, I'd want our finance team to weigh in first.",
      acoustic_metadata: { pitch_volatility: 0.28, speech_rate_wpm: 112, pause_duration_ms: 500, volume_intensity: 0.3 },
    }),
    expected: { sentiment: "deflecting", risk_level: "medium" },
    rationale: "Postpones commitment by deferring to an unnamed third party -- a different stalling mechanism than the original set's examples.",
  },
  {
    id: "holdout_aggressive_ultimatum",
    chunk: chunk({
      speaker: "counterpart",
      text: "Either you match the competitor's price by Friday, or we walk.",
      acoustic_metadata: { pitch_volatility: 0.6, speech_rate_wpm: 180, pause_duration_ms: 30, volume_intensity: 0.8 },
    }),
    expected: { sentiment: "aggressive", risk_level: "critical", volatility_flag: true },
    rationale: "Explicit ultimatum with a deadline and a walk-away threat.",
  },
  {
    id: "holdout_aggressive_condescending",
    chunk: chunk({
      speaker: "counterpart",
      text: "I would've thought that was obvious, but let me spell it out for you.",
      acoustic_metadata: { pitch_volatility: 0.45, speech_rate_wpm: 160, pause_duration_ms: 50, volume_intensity: 0.7 },
    }),
    expected: { sentiment: "aggressive", risk_level: "high" },
    rationale: "Condescension rather than an overt threat -- a subtler form of aggression than the ultimatum case.",
  },
  {
    id: "holdout_appeasement_avoid_friction",
    chunk: chunk({
      speaker: "candidate",
      text: "Whatever timeline suits you is fine by us, we don't want to be difficult.",
      acoustic_metadata: { pitch_volatility: 0.22, speech_rate_wpm: 130, pause_duration_ms: 100, volume_intensity: 0.3 },
    }),
    expected: { sentiment: "appeasement", risk_level: "medium" },
    rationale: "Explicit conflict-avoidance framing ('don't want to be difficult').",
  },
  {
    id: "holdout_shock_distress",
    chunk: chunk({
      speaker: "counterpart",
      text: "Hold on -- that's not what we agreed to at all -- give me a second.",
      acoustic_metadata: { pitch_volatility: 0.9, speech_rate_wpm: 210, pause_duration_ms: 10, volume_intensity: 0.85 },
    }),
    expected: { sentiment: "negative", acceptableSentiments: ["negative", "aggressive"], risk_level: "critical", volatility_flag: true },
    rationale: "Interrupted, shocked reaction to unexpected news -- an involuntary emotional reaction, not a deliberate deflection strategy.",
  },
];
