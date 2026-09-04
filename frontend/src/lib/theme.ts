import type { RiskLevel, Sentiment } from "@echory/contract";

/**
 * Static, fully-literal class-name lookups (not template-interpolated) --
 * Tailwind's content scanner only picks up class names it can find verbatim
 * in source text, so a data-driven `bg-signal-${level}` string would silently
 * produce no styles in the production build. Every value below is written
 * out in full for that reason.
 */

export const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

export const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  low: "bg-signal-low",
  medium: "bg-signal-medium",
  high: "bg-signal-high",
  critical: "bg-signal-critical",
};

export const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  low: "text-signal-low",
  medium: "text-signal-medium",
  high: "text-signal-high",
  critical: "text-signal-critical",
};

/** Hex twins of the classes above, for effects Tailwind can't express as a static class (dynamic glow color). */
export const RISK_HEX: Record<RiskLevel, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb7a1e",
  critical: "#ef4444",
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

export const SENTIMENT_BADGE_CLASS: Record<Sentiment, string> = {
  positive: "border-sentiment-positive/50 text-sentiment-positive bg-sentiment-positive/10",
  negative: "border-sentiment-negative/50 text-sentiment-negative bg-sentiment-negative/10",
  neutral: "border-sentiment-neutral/50 text-sentiment-neutral bg-sentiment-neutral/10",
  sarcastic: "border-sentiment-sarcastic/50 text-sentiment-sarcastic bg-sentiment-sarcastic/10",
  aggressive: "border-sentiment-aggressive/50 text-sentiment-aggressive bg-sentiment-aggressive/10",
  deflecting: "border-sentiment-deflecting/50 text-sentiment-deflecting bg-sentiment-deflecting/10",
  appeasement: "border-sentiment-appeasement/50 text-sentiment-appeasement bg-sentiment-appeasement/10",
};
