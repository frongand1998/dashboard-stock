import type { AnalysisResponse } from "../types/analysis";
import { useI18n } from "../lib/i18n";

interface Props {
  analysis: AnalysisResponse;
}

export function NewsPanel({ analysis }: Props) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{t("news.title")}</h2>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-slate-700">
          {analysis.newsSummary.stance.toUpperCase()} /{" "}
          {analysis.newsSummary.impact.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3">
        {analysis.newsSummary.items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 p-3"
          >
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.source} | {t("news.sentiment")} {item.sentiment.toFixed(2)}{" "}
              | {t("news.relevance")} {item.relevance.toFixed(2)} |{" "}
              {t("news.confidence")} {(item.sourceConfidence ?? 0.6).toFixed(2)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={`${item.id}-${tag}`}
                  className="rounded-full bg-paper px-2 py-1 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {analysis.newsSummary.sourceConfidence.length > 0 && (
        <div className="mt-4 rounded-xl bg-paper p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">
            {t("news.sourceConfidence")}
          </p>
          <div className="mt-2 space-y-2">
            {analysis.newsSummary.sourceConfidence.slice(0, 4).map((source) => (
              <div key={source.source}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-700">{source.source}</span>
                  <span className="font-semibold text-ink">
                    {(source.confidence * 100).toFixed(0)}% ({source.sampleSize}
                    )
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round(source.confidence * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.decision.contradictionWarning && (
        <p className="mt-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {analysis.decision.contradictionWarning}
        </p>
      )}
    </section>
  );
}
