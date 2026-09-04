import type { RiskLevel } from "@echory/contract";
import { RISK_BADGE_CLASS, RISK_DOT_CLASS, RISK_LABEL, RISK_ORDER } from "../lib/theme";

/** Required "Traffic Light Indicator": four stacked pill rows in descending severity, the current risk_level's row lit. */
export function TrafficLight({ riskLevel }: { riskLevel: RiskLevel | null }) {
  return (
    <div className="rounded-md bg-surface p-5 shadow-sm">
      <div className="mb-3 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
        Risk signal
      </div>
      <div className="flex flex-col gap-[9px]">
        {RISK_ORDER.map((level) => {
          const active = riskLevel === level;
          return (
            <div
              key={level}
              className={`flex items-center gap-3 rounded-full px-[13px] py-[9px] transition-colors duration-300 ${
                active ? RISK_BADGE_CLASS[level] : "bg-transparent text-neutral-600"
              }`}
            >
              <span
                className={`h-[22px] w-[22px] shrink-0 rounded-full ${active ? `${RISK_DOT_CLASS[level]} animate-soft-pulse` : "bg-neutral-300"}`}
              />
              <span className="font-body text-[13px] font-semibold uppercase tracking-[0.08em]">{RISK_LABEL[level]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
