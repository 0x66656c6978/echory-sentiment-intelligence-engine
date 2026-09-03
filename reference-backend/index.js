/**
 * reference-backend/index.js
 * ==========================
 * Track C Reference Backend — Sentiment Intelligence Engine (Placeholder)
 *
 * This server implements the full API contract required by the evaluation engine.
 * The analysis logic is a DELIBERATELY GENERIC rule-based placeholder — it uses
 * broad acoustic thresholds and a tiny generic sentiment lexicon only. It is NOT
 * tuned to any specific evaluation payload and is not meant to be accurate.
 *
 * As a Track C candidate you may either:
 *   (a) Replace analyzeChunk() with a real LLM call, or
 *   (b) Use this server as-is and focus entirely on building an exceptional frontend.
 *
 * HOW TO RUN:
 *   npm install
 *   npm start
 *   → Server runs on http://localhost:3000
 *
 * API CONTRACT:
 *   POST /api/telemetry/stream   ← main endpoint (required by evaluation engine)
 *   GET  /api/telemetry/session/:id/summary
 *   GET  /health
 */

"use strict";

const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ─── Placeholder Analysis Engine ─────────────────────────────────────────────
// TODO (optional): Replace this function with a real LLM call.
// This placeholder relies on acoustic signals plus a minimal, generic sentiment
// word list. It does NOT pattern-match any specific test phrases — accuracy is
// intentionally approximate. Upgrade it (or swap in an LLM) to improve results.

const GENERIC_POSITIVE = ["great", "good", "glad", "happy", "agree", "yes", "love", "excited", "thank"];
const GENERIC_NEGATIVE = ["no", "not", "never", "unacceptable", "concern", "problem", "wrong", "disappoint", "bad"];

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function analyzeChunk(payload) {
  const { text, acoustic_metadata, chunk_id } = payload;
  const start = Date.now();
  const lower = (text || "").toLowerCase();
  const a = acoustic_metadata || {};
  const pitch = a.pitch_volatility ?? 0;
  const wpm = a.speech_rate_wpm ?? 0;

  const isVolatile = pitch > 0.65 || wpm > 190;

  // Tiny generic lexical signal (sum of pos/neg word hits) — not test-specific.
  let posHits = 0, negHits = 0;
  for (const w of GENERIC_POSITIVE) if (lower.includes(w)) posHits++;
  for (const w of GENERIC_NEGATIVE) if (lower.includes(w)) negHits++;

  // Broad classification from acoustic arousal + generic lexical tilt only.
  let sentiment = "neutral";
  if (pitch > 0.80 && wpm > 180) {
    sentiment = "aggressive";
  } else if (negHits > posHits && pitch > 0.45) {
    sentiment = "negative";
  } else if (posHits > negHits) {
    sentiment = "positive";
  } else if (pitch > 0.55) {
    sentiment = "negative";
  }

  const riskLevel =
    sentiment === "aggressive" ? (isVolatile ? "critical" : "high") :
    sentiment === "negative"   ? (isVolatile ? "high" : "medium") :
    sentiment === "positive"   ? "low" :
    isVolatile ? "medium" : "low";

  // Confidence derived from signal strength (acoustic arousal + lexical margin),
  // so it varies per chunk rather than being a fixed constant.
  const lexicalMargin = Math.abs(posHits - negHits);
  const confidence = clamp(0.5 + 0.1 * lexicalMargin + 0.25 * Math.abs(pitch - 0.5), 0.5, 0.95);

  const hiddenIntents = {
    aggressive: "high_arousal_pressure",
    negative: "dissatisfaction_signal",
    positive: "agreement_signal",
    neutral: "informational",
  };

  const mitigations = {
    aggressive: "De-escalate, acknowledge the concern, slow the pace",
    negative: "Validate the objection explicitly before responding",
    positive: "Reinforce alignment and propose a concrete next step",
    neutral: "Ask an open-ended question to surface intent",
  };

  return {
    chunk_id,
    processing_latency_ms: Date.now() - start,
    sentiment,
    confidence: Math.round(confidence * 100) / 100,
    volatility_flag: isVolatile,
    hidden_intent: hiddenIntents[sentiment] ?? "unknown",
    mitigation_suggestion: mitigations[sentiment] ?? "Continue monitoring",
    risk_level: riskLevel,
  };
}

// ─── Session Store ────────────────────────────────────────────────────────────

const sessions = new Map();

// ─── Server Setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: "placeholder",   // ← evaluation engine reads this
    version: "1.1.0",
    timestamp: Date.now(),
  });
});

// Main endpoint — required by EVALUATION_ENGINE.js
app.post("/api/telemetry/stream", (req, res) => {
  const chunk = req.body;
  const result = analyzeChunk(chunk);

  // Store in session
  const list = sessions.get(chunk.session_id) ?? [];
  list.push({ ...result, timestamp_ms: chunk.timestamp_ms });
  sessions.set(chunk.session_id, list);

  res.json(result);
});

// Session summary — required for Track B; included here for completeness
app.get("/api/telemetry/session/:sessionId/summary", (req, res) => {
  const chunks = sessions.get(req.params.sessionId);
  if (!chunks || chunks.length === 0) {
    return res.status(404).json({ error: "Session not found" });
  }

  const volatileCount = chunks.filter(c => c.volatility_flag).length;
  const sentimentCounts = chunks.reduce((acc, c) => {
    acc[c.sentiment] = (acc[c.sentiment] ?? 0) + 1;
    return acc;
  }, {});
  const dominant = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];
  const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const topRisk = chunks
    .filter(c => c.risk_level === "critical" || c.risk_level === "high")
    .sort((a, b) => riskOrder[b.risk_level] - riskOrder[a.risk_level])
    .slice(0, 3)
    .map(c => ({ chunk_id: c.chunk_id, timestamp_ms: c.timestamp_ms, sentiment: c.sentiment, risk_level: c.risk_level, text_excerpt: c.hidden_intent }));

  res.json({
    session_id: req.params.sessionId,
    chunk_count: chunks.length,
    aggregated_volatility_score: Math.round((volatileCount / chunks.length) * 100) / 100,
    dominant_sentiment: dominant,
    top_risk_moments: topRisk,
  });
});

app.listen(PORT, () => {
  console.log(`Reference backend running on http://localhost:${PORT}`);
  console.log(`Mode: placeholder (generic rule-based — replace analyzeChunk() for LLM-powered analysis)`);
  console.log(`API: POST /api/telemetry/stream`);
});
