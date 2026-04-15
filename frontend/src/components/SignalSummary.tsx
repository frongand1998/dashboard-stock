import type { AnalysisResponse } from "../types/analysis";
import { useI18n } from "../lib/i18n";

interface Props {
  analysis: AnalysisResponse;
}

export function SignalSummary({ analysis }: Props) {
  const { t } = useI18n();
  const rows = [
    { label: t("signal.technical"), value: analysis.technicalScore },
    { label: t("signal.news"), value: analysis.newsScore },
    { label: t("signal.risk"), value: analysis.riskScore },
    { label: t("signal.final"), value: analysis.finalScore },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold text-ink">
        {t("signal.title")}
      </h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">{row.label}</span>
              <span className="font-semibold text-ink">
                {row.value.toFixed(1)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${row.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-paper p-3 text-sm text-slate-700">
        <p className="font-medium text-ink">{t("signal.holdUntil")}</p>
        {analysis.decision.holdUntilConditions.map((item) => (
          <p key={item} className="mt-1">
            {item}
          </p>
        ))}
      </div>

      {analysis.decision.riskGuardrailTriggered && (
        <p className="mt-3 rounded-lg bg-negative/10 px-3 py-2 text-sm font-medium text-negative">
          {t("signal.guardrail")}
        </p>
      )}
    </section>
  );
}
