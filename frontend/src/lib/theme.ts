import type { RiskLevel, Sentiment } from "@echory/contract";

/**
 * Static, fully-literal class-name lookups (not template-interpolated) --
 * Tailwind's content scanner only picks up class names it can find verbatim
 * in source text, so a data-driven `bg-accent-${n}` string would silently
 * produce no styles in the production build. Every value below is written
 * out in full for that reason. Values ported from the "Organic" mockup --
 * see docs/design/0009-alt-mockup/0009-ui-spec.md §4 for the source table.
 */

export const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

/** Pill fill + text, for the risk badge on a stream card -- also reused as-is for the active row fill in the Risk Signal stack (same table in the spec). */
export const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  low: "bg-accent2-200 text-accent2-800",
  medium: "bg-accent-200 text-accent-800",
  high: "bg-accent-400 text-accent-900",
  critical: "bg-accent-800 text-accent-100",
};

/** Lamp dot color -- deliberately distinct from the row/badge fill (see spec table). */
export const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  low: "bg-accent2-500",
  medium: "bg-accent-400",
  high: "bg-accent",
  critical: "bg-accent-700",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "POSITIVE",
  negative: "NEGATIVE",
  neutral: "NEUTRAL",
  sarcastic: "SARCASTIC",
  aggressive: "AGGRESSIVE",
  deflecting: "DEFLECTING",
  appeasement: "APPEASEMENT",
};

/** All seven values must be covered -- sarcastic/aggressive are the two intentionally-inverted (dark-fill) chips, since they're what the engine exists to catch. */
export const SENTIMENT_BADGE_CLASS: Record<Sentiment, string> = {
  positive: "bg-accent2-200 text-accent2-800",
  neutral: "bg-neutral-200 text-neutral-800",
  negative: "bg-accent-300 text-accent-900",
  sarcastic: "bg-neutral-800 text-accent-200",
  aggressive: "bg-accent-700 text-accent-100",
  deflecting: "bg-accent2-400 text-accent2-900",
  appeasement: "bg-accent2-100 text-accent2-700",
};
