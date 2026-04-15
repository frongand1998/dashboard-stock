import type { AnalysisResponse } from "../types/analysis";
import { useI18n } from "../lib/i18n";

const signalStyle: Record<string, string> = {
  BUY_NOW: "bg-positive text-white border-positive",
  HOLD: "bg-positive/15 text-positive border-positive/30",
  WAIT: "bg-caution/15 text-caution border-caution/30",
  AVOID: "bg-negative/15 text-negative border-negative/30",
  SELL_NOW: "bg-negative text-white border-negative",
};

const signalLabel: Record<string, string> = {
  BUY_NOW: "BUY NOW",
  HOLD: "HOLD",
  WAIT: "WAIT",
  AVOID: "AVOID",
  SELL_NOW: "SELL NOW",
};

interface Props {
  analysis: AnalysisResponse;
}

export function DecisionCard({ analysis }: Props) {
  const { t } = useI18n();
  const { decision } = analysis;
  const sig = decision.tradeSignal ?? decision.action;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">
          {t("decision.title")}
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${signalStyle[sig] ?? signalStyle["WAIT"]}`}
        >
          {signalLabel[sig] ?? sig}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs uppercase text-slate-500">
            {t("decision.buyZone")}
          </p>
          <p className="text-lg font-semibold text-ink">
            {decision.buyRange.low} - {decision.buyRange.high}
          </p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs uppercase text-slate-500">
            {t("decision.sellZone")}
          </p>
          <p className="text-lg font-semibold text-ink">
            {decision.sellRange.low} - {decision.sellRange.high}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase text-slate-500">
          {t("decision.confidence")}
        </p>
        <div className="mt-2 h-2 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${decision.confidence}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-slate-700">{decision.confidence}%</p>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase text-slate-500">
          {t("decision.topReasons")}
        </p>
        {decision.reasonsTop3.map((reason) => (
          <p
            key={reason}
            className="rounded-lg bg-paper px-3 py-2 text-sm text-slate-700"
          >
            {reason}
          </p>
        ))}
      </div>
    </section>
  );
}
