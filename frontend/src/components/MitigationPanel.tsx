import { useState } from "react";

/**
 * Required "Mitigation Panel": the copilot's current mitigation_suggestion.
 * "Used it" / "Not now" are local-only UI state -- there is no suggestion-
 * feedback endpoint or persistence (per docs/design/0009-alt-mockup/0009-ui-spec.md
 * §5). Parent keys this component on the suggestion string so the
 * acknowledgment resets automatically when a new suggestion arrives.
 */
export function MitigationPanel({ suggestion }: { suggestion: string | null }) {
  const [acknowledged, setAcknowledged] = useState(false);

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
        <div className="mt-auto flex items-center gap-2 pt-4">
          <button
            onClick={() => setAcknowledged(true)}
            disabled={acknowledged}
            className="rounded-full bg-accent px-4 py-[9px] font-heading text-xs text-bg transition-colors hover:bg-accent-600 disabled:cursor-default disabled:opacity-60"
          >
            {acknowledged ? "Noted" : "Used it"}
          </button>
          <button onClick={() => setAcknowledged(true)} className="rounded-full px-3 py-[9px] font-heading text-xs text-accent-300 hover:bg-accent-700/60">
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
