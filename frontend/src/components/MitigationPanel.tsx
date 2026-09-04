/** Required "Mitigation Panel": the copilot's actionable suggestion, framed like a whisper-screen readout a negotiator glances at mid-call. */
export function MitigationPanel({ suggestion }: { suggestion: string | null }) {
  return (
    <div className="border border-amber/40 bg-gradient-to-b from-amber/[0.08] to-transparent p-4">
      <div className="mb-2 font-display text-xs font-semibold tracking-[0.2em] text-amber">COPILOT — SUGGESTED MOVE</div>
      {suggestion ? (
        <p key={suggestion} className="animate-slide-in font-transcript text-lg italic leading-snug text-slate-100">
          &ldquo;{suggestion}&rdquo;
        </p>
      ) : (
        <p className="font-mono text-sm text-slate-600">awaiting signal…</p>
      )}
    </div>
  );
}
