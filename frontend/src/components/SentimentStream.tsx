import { useEffect, useRef } from "react";
import type { ChunkEntry } from "../lib/types";
import { AcousticBars } from "./AcousticBars";
import { RISK_BADGE_CLASS, RISK_LABEL, SENTIMENT_BADGE_CLASS, SENTIMENT_LABEL } from "../lib/theme";

function formatClock(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString(undefined, { hour12: false });
}

function speakerLabel(speaker: string): string {
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
}

function StreamCard({ entry, isNewestResolved }: { entry: ChunkEntry; isNewestResolved: boolean }) {
  const { request, response, status } = entry;
  const isCounterpart = request.speaker === "counterpart";
  const avatarClass = isCounterpart ? "bg-accent-300 text-accent-900" : "bg-accent2-300 text-accent2-900";
  const cardClass = status === "pending" ? "bg-neutral-100" : `bg-surface ${isNewestResolved ? "shadow-md" : ""}`;

  return (
    <div className={`animate-rise-in rounded-md p-5 ${cardClass}`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full font-body text-[10px] font-bold ${avatarClass}`}
          >
            {request.speaker.charAt(0).toUpperCase()}
          </span>
          <span className="font-body text-xs font-semibold text-ink">{speakerLabel(request.speaker)}</span>
          <span className="font-body text-[11px] font-medium text-neutral-500">{formatClock(request.timestamp_ms)}</span>
        </div>
        <AcousticBars acoustic={request.acoustic_metadata} />
      </div>

      <p className="text-pretty font-body text-base leading-[1.45] text-ink">{request.text}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-[9px]">
        {status === "pending" && (
          <span className="animate-breathe rounded-full bg-neutral-200 px-[10px] py-[3px] font-body text-[10.5px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            reading…
          </span>
        )}
        {status === "error" && (
          <span className="rounded-full border border-dashed border-accent-700/50 px-[10px] py-[3px] font-body text-[10.5px] font-semibold uppercase tracking-[0.1em] text-accent-700">
            no signal — {entry.error}
          </span>
        )}
        {status === "done" && response && (
          <>
            <span className={`rounded-md px-[10px] py-[3px] font-body text-[11px] font-medium tracking-[0.02em] ${SENTIMENT_BADGE_CLASS[response.sentiment]}`}>
              {SENTIMENT_LABEL[response.sentiment]}
            </span>
            <span className={`rounded-md px-[10px] py-[3px] font-body text-[11px] font-medium tracking-[0.02em] ${RISK_BADGE_CLASS[response.risk_level]}`}>
              {RISK_LABEL[response.risk_level]} RISK
            </span>
            <span className="font-body text-[11.5px] font-medium text-neutral-600">{response.hidden_intent}</span>
            <span className="font-body text-[11.5px] font-medium text-neutral-500">
              · {Math.round(response.confidence * 100)}%
            </span>
            {response.volatility_flag && (
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.08em] text-accent-700">volatile</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Required "Sentiment Stream": scrolling timeline of classified chunks, bottom-anchored so the newest is always in view. */
export function SentimentStream({ entries }: { entries: ChunkEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const newestResolvedId = [...entries].reverse().find((e) => e.status === "done")?.request.chunk_id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Sentiment stream
        </span>
        <span className="font-body text-[11px] text-neutral-500">newest at the bottom</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center font-body text-sm text-neutral-500">
            no active session — initiate a call to begin streaming analysis
          </div>
        ) : (
          <div className="flex min-h-full flex-col justify-end gap-3">
            {entries.map((entry) => (
              <StreamCard key={entry.request.chunk_id} entry={entry} isNewestResolved={entry.request.chunk_id === newestResolvedId} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
