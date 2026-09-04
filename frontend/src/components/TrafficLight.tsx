import type { RiskLevel } from "@echory/contract";
import { RISK_HEX, RISK_LABEL, RISK_ORDER } from "../lib/theme";

/**
 * Required "Traffic Light Indicator": modeled on a physical industrial stack
 * light (the stacked-lamp towers on factory floors) rather than a literal
 * red/yellow/green traffic signal -- reads at a glance from across a room,
 * which is the point of a stack light and exactly what a negotiator glancing
 * up mid-call needs.
 */
export function TrafficLight({ riskLevel }: { riskLevel: RiskLevel | null }) {
  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 font-display text-xs font-semibold tracking-[0.2em] text-slate-500">RISK SIGNAL</div>
      <div className="flex flex-col items-stretch gap-2.5 border border-line bg-void/70 p-4">
        {RISK_ORDER.map((level) => {
          const active = riskLevel === level;
          return (
            <div key={level} className="flex items-center gap-3">
              <span
                className={`h-8 w-8 shrink-0 rounded-full border border-black/50 transition-all duration-300 ${
                  active ? "animate-pulse-glow" : "bg-slate-800"
                }`}
                style={{
                  backgroundColor: active ? RISK_HEX[level] : undefined,
                  boxShadow: active ? `0 0 18px 5px ${RISK_HEX[level]}66` : "none",
                }}
              />
              <span
                className={`font-mono text-xs tracking-[0.15em] transition-colors duration-300 ${
                  active ? "font-semibold text-slate-100" : "text-slate-600"
                }`}
              >
                {RISK_LABEL[level]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
