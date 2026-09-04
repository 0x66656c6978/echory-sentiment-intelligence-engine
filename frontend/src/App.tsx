import { useCallback, useRef, useState } from "react";
import type { MitigationFeedbackAction, TelemetryChunkRequest } from "@echory/contract";
import { sendChunk } from "./lib/api";
import { buildNegotiationScript } from "./lib/negotiationScript";
import type { ChunkEntry } from "./lib/types";
import { SentimentStream } from "./components/SentimentStream";
import { TrafficLight } from "./components/TrafficLight";
import { VolatilityAlert } from "./components/VolatilityAlert";
import { MitigationPanel } from "./components/MitigationPanel";
import { AggregateTiles } from "./components/AggregateTiles";

type SessionStatus = "standby" | "running" | "complete" | "error";

const STATUS_META: Record<SessionStatus, { label: string; pillClass: string; dotClass: string; breathe: boolean }> = {
  standby: { label: "Standby", pillClass: "bg-neutral-200 text-neutral-700", dotClass: "bg-neutral-400", breathe: false },
  running: { label: "Live", pillClass: "bg-accent-200 text-accent-800", dotClass: "bg-accent-600", breathe: true },
  complete: { label: "Complete", pillClass: "bg-accent2-200 text-accent2-800", dotClass: "bg-accent2-600", breathe: false },
  error: { label: "Connection lost", pillClass: "bg-accent-300 text-accent-900", dotClass: "bg-accent-700", breathe: false },
};

export default function App() {
  const [entries, setEntries] = useState<ChunkEntry[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("standby");
  const [isSending, setIsSending] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const scriptRef = useRef<TelemetryChunkRequest[]>([]);
  const nextIndexRef = useRef(0);
  // React only disables the button after the next render commits, so a
  // second click landing before that repaint isn't blocked by `disabled`
  // alone -- this ref is set synchronously, closing that race so the same
  // chunk can never be sent twice from overlapping clicks.
  const isSendingRef = useRef(false);

  // One click sends exactly one chunk -- streaming the whole scripted call
  // automatically (the original behavior) dumped all 9 chunks in ~10s, which
  // read as overwhelming rather than live. Standby/complete/error starts a
  // fresh session on the next click; mid-session, it advances to the next
  // chunk in the same script.
  const advance = useCallback(async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);

    try {
      if (sessionStatus !== "running") {
        const script = buildNegotiationScript();
        scriptRef.current = script;
        nextIndexRef.current = 0;
        sessionIdRef.current = script[0]?.session_id ?? null;
        setEntries([]);
        setSessionStatus("running");
      }

      const index = nextIndexRef.current;
      const request = scriptRef.current[index];
      if (!request) return; // script already exhausted -- button should be disabled before this can happen

      setEntries((prev) => [...prev, { request, status: "pending" }]);
      try {
        const response = await sendChunk(request);
        setEntries((prev) =>
          prev.map((entry) => (entry.request.chunk_id === request.chunk_id ? { ...entry, response, status: "done" } : entry)),
        );
        nextIndexRef.current = index + 1;
        if (nextIndexRef.current >= scriptRef.current.length) setSessionStatus("complete");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setEntries((prev) =>
          prev.map((entry) => (entry.request.chunk_id === request.chunk_id ? { ...entry, status: "error", error: message } : entry)),
        );
        setSessionStatus("error");
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [sessionStatus]);

  const handleMitigationFeedback = useCallback((chunkId: string, action: MitigationFeedbackAction) => {
    setEntries((prev) => prev.map((entry) => (entry.request.chunk_id === chunkId ? { ...entry, mitigationFeedback: action } : entry)));
  }, []);

  const latestDone = [...entries].reverse().find((entry) => entry.status === "done" && entry.response);
  const currentRiskLevel = latestDone?.response?.risk_level ?? null;
  const volatilityActive = latestDone?.response?.volatility_flag ?? false;
  const mitigationSuggestion = latestDone?.response?.mitigation_suggestion ?? null;

  // Aggregate strip: arithmetic over classifications already returned, no
  // second LLM call. See AggregateTiles.tsx for the definitions.
  const doneResponses = entries.filter((entry) => entry.status === "done" && entry.response).map((entry) => entry.response!);
  const volatilityIndex = doneResponses.length
    ? doneResponses.filter((response) => response.volatility_flag).length / doneResponses.length
    : null;
  const dominantTone = (() => {
    if (doneResponses.length === 0) return null;
    const counts = new Map<string, number>();
    for (const response of doneResponses) counts.set(response.sentiment, (counts.get(response.sentiment) ?? 0) + 1);
    return [...counts.entries()].reduce((best, current) => (current[1] > best[1] ? current : best))[0];
  })();

  const statusMeta = STATUS_META[sessionStatus];
  const totalChunks = scriptRef.current.length;
  const buttonLabel = isSending
    ? "Sending…"
    : sessionStatus === "running"
      ? `Send next chunk (${nextIndexRef.current + 1} of ${totalChunks})`
      : sessionStatus === "complete"
        ? "Start new call"
        : sessionStatus === "error"
          ? "Retry — start new call"
          : "Initiate simulated call";

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 border-b border-ink/[0.16] px-7 py-[18px]">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-[22px] text-ink">Copilot</h1>
          <p className="font-body text-[13px] text-neutral-600">
            Northwind renewal{sessionIdRef.current ? ` · ${sessionIdRef.current}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em] ${statusMeta.pillClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass} ${statusMeta.breathe ? "animate-breathe" : ""}`} />
            {statusMeta.label}
          </div>
          {latestDone?.response && (
            <span className="font-body text-xs text-neutral-600">
              {latestDone.response.processing_latency_ms} ms · {entries.length}
              {totalChunks ? ` / ${totalChunks}` : ""} chunks
            </span>
          )}
          <button
            onClick={advance}
            disabled={isSending}
            className="rounded-full bg-accent px-4 py-2 font-heading text-xs text-bg transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {buttonLabel}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 p-7 lg:flex-row">
        <div className="min-h-[420px] flex-1 lg:h-full lg:min-w-0">
          <SentimentStream entries={entries} />
        </div>

        <aside className="flex w-full flex-col gap-4 lg:h-full lg:w-[352px] lg:shrink-0">
          <TrafficLight riskLevel={currentRiskLevel} />
          <VolatilityAlert active={volatilityActive} />
          <MitigationPanel
            key={latestDone?.request.chunk_id ?? "none"}
            suggestion={mitigationSuggestion}
            sessionId={sessionIdRef.current}
            chunkId={latestDone?.request.chunk_id ?? null}
            onFeedback={handleMitigationFeedback}
          />
          <AggregateTiles volatilityIndex={volatilityIndex} dominantTone={dominantTone} />
        </aside>
      </main>
    </div>
  );
}
