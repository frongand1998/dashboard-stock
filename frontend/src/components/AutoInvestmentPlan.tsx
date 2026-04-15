import { useEffect, useState } from "react";
import { getInvestmentPlan, getPlanHistory } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type {
  AssetClass,
  InvestmentPlan,
  PlanHistoryEntry,
  PlanTheme,
  Timeframe,
} from "../types/analysis";

interface Props {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
}

type Preset = {
  labelKey: string;
  theme: PlanTheme;
  symbol?: string;
  assetClass?: AssetClass;
  prompt?: string;
};

const presets: Preset[] = [
  { labelKey: "preset.now", theme: "now" },
  {
    labelKey: "preset.lrcx",
    theme: "now",
    symbol: "LRCX",
    assetClass: "stock",
  },
  {
    labelKey: "preset.nvda",
    theme: "now",
    symbol: "NVDA",
    assetClass: "stock",
  },
  { labelKey: "preset.war", theme: "war", symbol: "LMT", assetClass: "stock" },
  { labelKey: "preset.ai", theme: "ai", symbol: "NVDA", assetClass: "stock" },
];

const signalClass: Record<string, string> = {
  BUY_NOW: "bg-positive text-white",
  SELL_NOW: "bg-negative text-white",
  HOLD: "bg-positive/15 text-positive",
  WAIT: "bg-caution/15 text-caution",
  AVOID: "bg-negative/15 text-negative",
};

export function AutoInvestmentPlan({ symbol, assetClass, timeframe }: Props) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [compareLeft, setCompareLeft] = useState<InvestmentPlan | null>(null);
  const [compareRight, setCompareRight] = useState<InvestmentPlan | null>(null);
  const [history, setHistory] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState(
    "AI capex and valuation risk",
  );
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshHistory();
  }, [symbol]);

  async function refreshHistory() {
    try {
      const items = await getPlanHistory({ symbol, limit: 12 });
      setHistory(items);
    } catch {
      // Keep panel usable if history endpoint is temporarily unavailable.
    }
  }

  function planShareText(target: InvestmentPlan): string {
    return [
      `${target.planName}`,
      `Symbol: ${target.symbol} (${target.assetClass})`,
      `Signal: ${target.tradeSignal} | Confidence: ${target.confidence.toFixed(1)}`,
      `Action now: ${target.actionNow}`,
      `Summary: ${target.summary}`,
      "Allocation:",
      ...target.entries.map(
        (entry) =>
          `- ${entry.label}: ${entry.allocationPercent.toFixed(1)}% (${entry.rationale})`,
      ),
      "Risk rules:",
      ...target.riskRules.map((item) => `- ${item}`),
      `Review cadence: ${target.reviewCadence}`,
    ].join("\n");
  }

  async function copyPlan(target: InvestmentPlan) {
    try {
      await navigator.clipboard.writeText(planShareText(target));
      setCopyMessage(t("plan.copied", { symbol: target.symbol }));
      setTimeout(() => setCopyMessage(null), 3000);
    } catch {
      setError(t("plan.unableCopy"));
    }
  }

  async function loadPlan(preset: Preset) {
    setLoading(true);
    setError(null);
    try {
      const next = await getInvestmentPlan({
        symbol: preset.symbol ?? symbol,
        assetClass: preset.assetClass ?? assetClass,
        timeframe,
        theme: preset.theme,
        prompt: preset.prompt,
      });
      setPlan(next);
      await refreshHistory();
    } catch {
      setError(t("plan.unableLoad"));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomPlan() {
    setLoading(true);
    setError(null);
    try {
      const next = await getInvestmentPlan({
        symbol,
        assetClass,
        timeframe,
        theme: "custom",
        prompt: customPrompt,
      });
      setPlan(next);
      await refreshHistory();
    } catch {
      setError(t("plan.unableCustom"));
    } finally {
      setLoading(false);
    }
  }

  async function compareNvdaVsLrcx() {
    setCompareLoading(true);
    setError(null);
    try {
      const [nvda, lrcx] = await Promise.all([
        getInvestmentPlan({
          symbol: "NVDA",
          assetClass: "stock",
          timeframe,
          theme: "ai",
        }),
        getInvestmentPlan({
          symbol: "LRCX",
          assetClass: "stock",
          timeframe,
          theme: "now",
        }),
      ]);
      setCompareLeft(nvda);
      setCompareRight(lrcx);
      await refreshHistory();
    } catch {
      setError(t("plan.unableCompare"));
    } finally {
      setCompareLoading(false);
    }
  }

  async function compareCurrentVsNvda() {
    setCompareLoading(true);
    setError(null);
    try {
      const [currentPlan, nvda] = await Promise.all([
        getInvestmentPlan({
          symbol,
          assetClass,
          timeframe,
          theme: "now",
        }),
        getInvestmentPlan({
          symbol: "NVDA",
          assetClass: "stock",
          timeframe,
          theme: "ai",
        }),
      ]);
      setCompareLeft(currentPlan);
      setCompareRight(nvda);
      await refreshHistory();
    } catch {
      setError(t("plan.unableCompareNvda"));
    } finally {
      setCompareLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{t("plan.title")}</h2>
        {plan && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${signalClass[plan.tradeSignal] ?? "bg-paper text-ink"}`}
          >
            {plan.tradeSignal}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.labelKey}
            onClick={() => loadPlan(preset)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-accent hover:text-accent"
          >
            {t(preset.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder={t("plan.customPlaceholder")}
        />
        <button
          onClick={loadCustomPlan}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white"
        >
          {t("plan.customButton")}
        </button>
      </div>

      {loading && (
        <p className="mt-3 text-sm text-slate-600">{t("plan.building")}</p>
      )}
      {compareLoading && (
        <p className="mt-3 text-sm text-slate-600">{t("plan.comparing")}</p>
      )}
      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      {copyMessage && (
        <p className="mt-3 text-sm text-positive">{copyMessage}</p>
      )}

      {plan && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-paper p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{plan.planName}</p>
              <button
                onClick={() => copyPlan(plan)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {t("plan.copySummary")}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-700">{plan.summary}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t("plan.confidence")} {plan.confidence.toFixed(1)} |{" "}
              {t("plan.review")} {plan.reviewCadence}
            </p>
            <p className="mt-2 text-sm font-medium text-ink">
              {plan.actionNow}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              {t("plan.allocation")}
            </p>
            <div className="mt-2 space-y-2">
              {plan.entries.map((entry) => (
                <div key={entry.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-700">{entry.label}</span>
                    <span className="font-semibold text-ink">
                      {entry.allocationPercent.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{entry.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              {t("plan.execution")}
            </p>
            {plan.executionChecklist.map((item) => (
              <p key={item} className="mt-1 text-sm text-slate-700">
                - {item}
              </p>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              {t("plan.riskRules")}
            </p>
            {plan.riskRules.map((item) => (
              <p key={item} className="mt-1 text-sm text-slate-700">
                - {item}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase text-slate-500">
            {t("plan.compare")}
          </p>
          <button
            onClick={compareNvdaVsLrcx}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            {t("plan.nvdaVsLrcx")}
          </button>
          <button
            onClick={compareCurrentVsNvda}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            {t("plan.currentVsNvda")}
          </button>
        </div>

        {compareLeft && compareRight && (
          <div className="grid gap-3 md:grid-cols-2">
            {[compareLeft, compareRight].map((item) => (
              <div
                key={`${item.symbol}-${item.generatedAt}`}
                className="rounded-xl bg-paper p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {item.symbol} {item.tradeSignal}
                  </p>
                  <button
                    onClick={() => copyPlan(item)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {t("plan.copy")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Confidence {item.confidence.toFixed(1)} | {item.reviewCadence}
                </p>
                <p className="mt-1 text-xs text-slate-700">{item.actionNow}</p>
                <div className="mt-2 text-xs text-slate-600">
                  {item.entries.map((entry) => (
                    <p key={entry.label}>
                      {entry.label}: {entry.allocationPercent.toFixed(1)}%
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">
          {t("plan.savedHistory")}
        </p>
        <div className="mt-2 space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-lg bg-paper px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">
                  {entry.plan.symbol} {entry.plan.theme.toUpperCase()}{" "}
                  {entry.plan.tradeSignal}
                </span>
                <span className="text-slate-500">
                  {new Date(entry.plan.generatedAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {entry.plan.summary}
              </p>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-slate-500">{t("plan.noSaved")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
