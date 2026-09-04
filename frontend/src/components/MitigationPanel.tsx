import { useState } from "react";
import type { MitigationFeedbackAction } from "@echory/contract";
import { sendMitigationFeedback } from "../lib/api";

interface MitigationPanelProps {
  suggestion: string | null;
  /** Identifies which chunk the current suggestion belongs to -- feedback is recorded against this, not the suggestion text itself. */
  sessionId: string | null;
  chunkId: string | null;
  onFeedback: (chunkId: string, action: MitigationFeedbackAction) => void;
}

/**
 * Required "Mitigation Panel": the copilot's current mitigation_suggestion.
 * "Used it" / "Not now" actually record the negotiator's response against
 * the originating chunk (POST /api/telemetry/session/:id/mitigation-feedback)
 * -- previously local-only UI state that reset with nothing to show for it
 * (per docs/design/0009-alt-mockup/0009-ui-spec.md §5's original, deliberately
 * minimal scoping). Keyed by `chunkId` from the parent (App.tsx) so this
 * component remounts -- and its pending/error state resets -- on every new
 * suggestion.
 */
export function MitigationPanel({ suggestion, sessionId, chunkId, onFeedback }: MitigationPanelProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentAction, setSentAction] = useState<MitigationFeedbackAction | null>(null);

  async function respond(action: MitigationFeedbackAction) {
    if (!sessionId || !chunkId || status === "sending") return;
    setStatus("sending");
    try {
      await sendMitigationFeedback(sessionId, chunkId, action);
      setSentAction(action);
      setStatus("sent");
      onFeedback(chunkId, action);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded-md bg-accent-800 p-[22px]">
      <div className="mb-2 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-300">
        Suggested move
      </div>
      {suggestion ? (
        <p className="animate-rise-in text-pretty font-heading text-[25px] leading-[1.25] text-accent-100">
          {suggestion}
        </p>
      ) : (
        <p className="font-body text-sm text-accent-300/70">Awaiting signal…</p>
      )}
      {suggestion && (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {status === "sent" ? (
            <span className="font-body text-xs font-semibold text-accent-200">
              {sentAction === "used" ? "✓ Marked as used" : "Dismissed"} — logged to this call
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => respond("used")}
                disabled={status === "sending"}
                className="rounded-full bg-accent px-4 py-[9px] font-heading text-xs text-bg transition-colors hover:bg-accent-600 disabled:cursor-default disabled:opacity-60"
              >
                {status === "sending" ? "Recording…" : "Used it"}
              </button>
              <button
                onClick={() => respond("dismissed")}
                disabled={status === "sending"}
                className="rounded-full px-3 py-[9px] font-heading text-xs text-accent-300 hover:bg-accent-700/60 disabled:cursor-default disabled:opacity-60"
              >
                Not now
              </button>
            </div>
          )}
          {status === "error" && (
            <span className="font-body text-[11px] text-accent-300">Couldn't record that — try again.</span>
          )}
        </div>
      )}
    </div>
  );
}
