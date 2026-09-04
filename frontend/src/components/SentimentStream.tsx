import { useEffect, useRef } from "react";
import type { ChunkEntry } from "../lib/types";
import { AcousticBars } from "./AcousticBars";
import { RISK_LABEL, RISK_TEXT_CLASS, SENTIMENT_BADGE_CLASS, SENTIMENT_LABEL } from "../lib/theme";

function formatClock(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString(undefined, { hour12: false });
}

function StreamRow({ entry }: { entry: ChunkEntry }) {
  const { request, response, status } = entry;
  const speakerLabel = request.speaker === "counterpart" ? "COUNTERPART" : "CANDIDATE";

  return (
    <div className="animate-slide-in border-b border-line/60 px-4 py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] tracking-widest text-slate-500">{formatClock(request.timestamp_ms)}</span>
          <span
            className={`font-mono text-[10px] font-semibold tracking-[0.15em] ${
              request.speaker === "counterpart" ? "text-slate-300" : "text-cyan-400"
            }`}
          >
            {speakerLabel}
          </span>
        </div>
        <AcousticBars acoustic={request.acoustic_metadata} />
      </div>

      <p className="font-transcript text-[15px] italic leading-snug text-slate-200">&ldquo;{request.text}&rdquo;</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {status === "pending" && (
          <span className="bg-shimmer animate-shimmer border border-line px-2 py-0.5 font-mono text-[10px] tracking-widest text-slate-500">
            ANALYZING…
          </span>
        )}
        {status === "error" && (
          <span className="border border-dashed border-red-500/50 px-2 py-0.5 font-mono text-[10px] tracking-widest text-red-400">
            NO SIGNAL — {entry.error}
          </span>
        )}
        {status === "done" && response && (
          <>
            <span className={`border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.1em] ${SENTIMENT_BADGE_CLASS[response.sentiment]}`}>
              {SENTIMENT_LABEL[response.sentiment]}
            </span>
            <span className={`font-mono text-[10px] font-semibold tracking-[0.1em] ${RISK_TEXT_CLASS[response.risk_level]}`}>
              {RISK_LABEL[response.risk_level]} RISK
            </span>
            <span className="font-mono text-[10px] tracking-widest text-slate-600">
              conf {Math.round(response.confidence * 100)}%
            </span>
            <span className="font-mono text-[10px] tracking-widest text-slate-600">{response.processing_latency_ms}ms</span>
            {response.volatility_flag && (
              <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-red-400">⚡ VOLATILE</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Required "Sentiment Stream": scrolling timeline of classified chunks, auto-scrolling to the newest entry. */
export function SentimentStream({ entries }: { entries: ChunkEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col border border-line bg-panel">
      <div className="border-b border-line px-4 py-3 font-display text-xs font-semibold tracking-[0.2em] text-slate-500">
        SENTIMENT STREAM
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-16 text-center font-mono text-sm text-slate-600">
            no active session — initiate a call to begin streaming analysis
          </div>
        ) : (
          <>
            {entries.map((entry) => (
              <StreamRow key={entry.request.chunk_id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
