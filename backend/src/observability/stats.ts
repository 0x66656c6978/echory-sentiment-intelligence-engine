import type { LLMCallLogEntry } from "./llmLogger.js";

export interface LatencyStats {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

/**
 * Groups logged LLM calls by model and computes latency stats — this is what
 * ticket 0006's local LLM benchmark reads to compare candidate models.
 */
export function computeLatencyStatsByModel(entries: LLMCallLogEntry[]): Record<string, LatencyStats> {
  const byModel = new Map<string, number[]>();
  for (const entry of entries) {
    const list = byModel.get(entry.model) ?? [];
    list.push(entry.latency_ms);
    byModel.set(entry.model, list);
  }

  const stats: Record<string, LatencyStats> = {};
  for (const [model, latencies] of byModel) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((total, v) => total + v, 0);
    stats[model] = {
      count: sorted.length,
      avgMs: sum / sorted.length,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
    };
  }
  return stats;
}
