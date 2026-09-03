import { useState } from "react";
import type { TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";
import { sendChunk } from "./lib/api";
import { FIXTURE_RESULTS } from "./fixtures";

function buildSampleRequest(): TelemetryChunkRequest {
  return {
    chunk_id: `chunk_${Date.now()}`,
    session_id: "session_dev_test",
    timestamp_ms: Date.now(),
    speaker: "counterpart",
    text: "Yes, we are absolutely committed to the partnership - though naturally our legal team will need to review every single line.",
    acoustic_metadata: {
      pitch_volatility: 0.82,
      speech_rate_wpm: 187,
      pause_duration_ms: 340,
      volume_intensity: 0.61,
    },
  };
}

type Status = "idle" | "loading" | "error";

export default function App() {
  const [results, setResults] = useState<TelemetryChunkResponse[]>(FIXTURE_RESULTS);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendTestChunk() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const result = await sendChunk(buildSampleRequest());
      setResults((prev) => [result, ...prev]);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold mb-1">Sentiment Intelligence Engine</h1>
      <p className="text-slate-400 mb-6">
        Bootstrap dashboard (ticket 0002) — plain list view, UI polish comes in ticket 0009.
      </p>

      <button
        onClick={handleSendTestChunk}
        disabled={status === "loading"}
        className="mb-3 rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "loading" ? "Sending..." : "Send test chunk to backend"}
      </button>

      {status === "error" && (
        <p className="mb-4 text-sm text-red-400">Not connected to backend: {errorMessage}</p>
      )}

      <ul className="space-y-2">
        {results.map((r, i) => (
          <li
            key={`${r.chunk_id}-${i}`}
            className="rounded border border-slate-800 bg-slate-900 p-3 text-sm"
          >
            <div className="flex justify-between">
              <span className="font-mono text-slate-400">{r.chunk_id}</span>
              <span className="font-semibold">
                {r.sentiment} · {r.risk_level}
              </span>
            </div>
            <div className="mt-1 text-slate-300">{r.mitigation_suggestion}</div>
            <div className="mt-1 text-xs text-slate-500">
              confidence {r.confidence} · volatility {r.volatility_flag ? "yes" : "no"} ·{" "}
              {r.processing_latency_ms}ms
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
