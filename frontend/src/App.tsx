import { useCallback, useRef, useState } from "react";
import { sendChunk } from "./lib/api";
import { buildNegotiationScript } from "./lib/negotiationScript";
import type { ChunkEntry } from "./lib/types";
import { SentimentStream } from "./components/SentimentStream";
import { TrafficLight } from "./components/TrafficLight";
import { VolatilityAlert } from "./components/VolatilityAlert";
import { MitigationPanel } from "./components/MitigationPanel";

type SessionStatus = "standby" | "running" | "complete" | "error";

const STATUS_META: Record<SessionStatus, { label: string; dotClass: string }> = {
  standby: { label: "STANDBY", dotClass: "bg-slate-600" },
  running: { label: "LIVE", dotClass: "bg-red-500 animate-blink" },
  complete: { label: "SESSION COMPLETE", dotClass: "bg-signal-low" },
  error: { label: "CONNECTION LOST", dotClass: "bg-signal-critical" },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Deliberate pacing between chunks -- real speech doesn't arrive in a burst,
// and a live-feeling call is the whole point of this demo. Not a technical
// requirement of the API itself.
const CHUNK_PACING_MS = 1400;

export default function App() {
  const [entries, setEntries] = useState<ChunkEntry[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("standby");
  const sessionIdRef = useRef<string | null>(null);
  // React only disables the button after the next render commits, so a
  // second click landing before that repaint isn't blocked by `disabled`
  // alone -- this ref is set synchronously, closing that race so two
  // sessions can never run concurrently and interleave their state updates.
  const isRunningRef = useRef(false);

  const runSession = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const script = buildNegotiationScript();
    sessionIdRef.current = script[0]?.session_id ?? null;
    setEntries([]);
    setSessionStatus("running");

    for (const request of script) {
      setEntries((prev) => [...prev, { request, status: "pending" }]);
      try {
        const response = await sendChunk(request);
        setEntries((prev) =>
          prev.map((entry) => (entry.request.chunk_id === request.chunk_id ? { ...entry, response, status: "done" } : entry)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setEntries((prev) =>
          prev.map((entry) => (entry.request.chunk_id === request.chunk_id ? { ...entry, status: "error", error: message } : entry)),
        );
        setSessionStatus("error");
        isRunningRef.current = false;
        return;
      }
      await sleep(CHUNK_PACING_MS);
    }
    setSessionStatus("complete");
    isRunningRef.current = false;
  }, []);

  const latestDone = [...entries].reverse().find((entry) => entry.status === "done" && entry.response);
  const currentRiskLevel = latestDone?.response?.risk_level ?? null;
  const volatilityActive = latestDone?.response?.volatility_flag ?? false;
  const mitigationSuggestion = latestDone?.response?.mitigation_suggestion ?? null;
  const statusMeta = STATUS_META[sessionStatus];
  const isRunning = sessionStatus === "running";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-slate-100">
              Sentiment Intelligence Engine
            </h1>
            <p className="mt-0.5 font-mono text-xs tracking-widest text-slate-500">
              live negotiation copilot — call monitoring console
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 font-mono text-xs tracking-widest">
              <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
              <span className="text-slate-400">{statusMeta.label}</span>
              {sessionIdRef.current && sessionStatus !== "standby" && (
                <span className="text-slate-600">· {sessionIdRef.current}</span>
              )}
            </div>
            <button
              onClick={runSession}
              disabled={isRunning}
              className="border border-amber/60 bg-amber/10 px-4 py-2 font-mono text-xs font-semibold tracking-widest text-amber transition-colors hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? "SESSION IN PROGRESS…" : "INITIATE SIMULATED CALL"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6 lg:flex-row">
        <div className="min-h-[420px] flex-1 lg:h-[calc(100vh-140px)]">
          <SentimentStream entries={entries} />
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
          <TrafficLight riskLevel={currentRiskLevel} />
          <VolatilityAlert active={volatilityActive} />
          <MitigationPanel suggestion={mitigationSuggestion} />
        </aside>
      </main>
    </div>
  );
}
