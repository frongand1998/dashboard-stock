import { useEffect, useMemo, useState } from "react";
import {
  createAlert,
  deleteAlert,
  getAlerts,
  getAnalysis,
  getStrategyHistory,
  getWatchlist,
  openQuoteStream,
} from "./lib/api";
import type {
  AlertRule,
  AnalysisResponse,
  AssetClass,
  LiveQuote,
  StrategyHistoryItem,
  StrategyStreamEvent,
  Timeframe,
  TriggeredAlert,
  WatchlistItem,
} from "./types/analysis";
import { DecisionCard } from "./components/DecisionCard";
import { NewsPanel } from "./components/NewsPanel";
import { PricePanel } from "./components/PricePanel";
import { SignalSummary } from "./components/SignalSummary";
import { PriceChart } from "./components/PriceChart";
import { AutoInvestmentPlan } from "./components/AutoInvestmentPlan";
import { type Locale, useI18n } from "./lib/i18n";

const timeframes: Timeframe[] = ["15m", "1h", "4h", "1d"];

function formatAgo(
  isoTimestamp: string | null,
  nowMs: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!isoTimestamp) return t("app.waitingStrategy");
  const deltaSec = Math.max(
    0,
    Math.floor((nowMs - new Date(isoTimestamp).getTime()) / 1000),
  );
  if (deltaSec < 60) return t("common.secondsAgo", { value: deltaSec });
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return t("common.minutesAgo", { value: min });
  const hr = Math.floor(min / 60);
  return t("common.hoursAgo", { value: hr });
}

function formatNullableNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "-";
}

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<WatchlistItem | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [assetClassInput, setAssetClassInput] = useState<AssetClass>("stock");
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [strategyHistory, setStrategyHistory] = useState<StrategyHistoryItem[]>(
    [],
  );
  const [strategyUpdatedAt, setStrategyUpdatedAt] = useState<string | null>(
    null,
  );
  const [newsShock, setNewsShock] = useState<{
    delta: number;
    direction: "up" | "down";
    atMs: number;
  } | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [alertDirection, setAlertDirection] = useState<"above" | "below">(
    "above",
  );
  const [alertTargetPrice, setAlertTargetPrice] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getWatchlist()
      .then((items) => {
        setWatchlist(items);
        setSelected(items[0] ?? null);
      })
      .catch(() => setError(t("app.unableWatchlist")));

    getAlerts()
      .then((data) => {
        setAlertRules(data.rules);
        setTriggeredAlerts(data.triggered);
      })
      .catch(() => {
        // Alert UI is optional, so this failure should not block analysis features.
      });
  }, []);

  useEffect(() => {
    if (!selected) return;

    setLoading(true);
    setError(null);

    getAnalysis(selected.symbol, selected.assetClass, timeframe)
      .then((res) => setAnalysis(res))
      .catch(() => setError(t("app.unableAnalysis")))
      .finally(() => setLoading(false));
  }, [selected, timeframe, t]);

  useEffect(() => {
    if (!selected) return;

    getStrategyHistory(selected.symbol, selected.assetClass, timeframe, 50)
      .then((items) => setStrategyHistory(items))
      .catch(() => {
        // History panel is additive; keep UI usable if this fails.
      });
  }, [selected, timeframe]);

  useEffect(() => {
    if (!selected) return;

    const close = openQuoteStream(
      selected.symbol,
      selected.assetClass,
      timeframe,
      (quote) => setLiveQuote(quote),
      (event) => setTriggeredAlerts((prev) => [event, ...prev].slice(0, 20)),
      (strategy: StrategyStreamEvent) => {
        setStrategyUpdatedAt(strategy.timestamp);
        setStrategyHistory((prev) => {
          const entry: StrategyHistoryItem = {
            symbol: strategy.symbol,
            assetClass: strategy.assetClass,
            timeframe: strategy.timeframe,
            quotePrice: liveQuote?.price ?? analysis?.quote.price ?? 0,
            technicalScore: strategy.technicalScore,
            newsScore: strategy.newsScore,
            riskScore: strategy.riskScore,
            finalScore: strategy.finalScore,
            decision: strategy.decision,
            sourceConfidence: strategy.newsSummary.sourceConfidence,
            timestamp: strategy.timestamp,
          };

          const merged = [entry, ...prev];
          const deduped: StrategyHistoryItem[] = [];
          const seen = new Set<string>();
          for (const item of merged) {
            const key = `${item.timestamp}-${item.decision.tradeSignal}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(item);
            if (deduped.length >= 50) break;
          }
          return deduped;
        });
        setAnalysis((prev) => {
          if (!prev) return prev;
          if (
            prev.symbol !== strategy.symbol ||
            prev.assetClass !== strategy.assetClass
          ) {
            return prev;
          }

          const newsDelta = strategy.newsScore - prev.newsScore;
          if (Math.abs(newsDelta) >= 8) {
            setNewsShock({
              delta: Math.abs(newsDelta),
              direction: newsDelta >= 0 ? "up" : "down",
              atMs: Date.now(),
            });
          }

          return {
            ...prev,
            indicators: strategy.indicators,
            technicalScore: strategy.technicalScore,
            newsScore: strategy.newsScore,
            riskScore: strategy.riskScore,
            finalScore: strategy.finalScore,
            newsSummary: strategy.newsSummary,
            decision: strategy.decision,
            timestamp: strategy.timestamp,
          };
        });
      },
    );

    return () => close();
  }, [selected, timeframe]);

  const sortedWatchlist = useMemo(
    () =>
      [...watchlist].sort(
        (a, b) =>
          a.assetClass.localeCompare(b.assetClass) ||
          a.symbol.localeCompare(b.symbol),
      ),
    [watchlist],
  );

  function addCustomAsset() {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;
    const newItem = { symbol, assetClass: assetClassInput };
    setWatchlist((prev) => [
      newItem,
      ...prev.filter(
        (p) => !(p.symbol === symbol && p.assetClass === assetClassInput),
      ),
    ]);
    setSelected(newItem);
  }

  async function addAlertRule() {
    if (!selected) return;
    const price = Number(alertTargetPrice);
    if (!price || Number.isNaN(price) || price <= 0) return;

    try {
      const rule = await createAlert({
        symbol: selected.symbol,
        assetClass: selected.assetClass,
        direction: alertDirection,
        targetPrice: price,
      });
      setAlertRules((prev) => [rule, ...prev]);
      setAlertTargetPrice("");
    } catch {
      setError(t("app.unableCreateAlert"));
    }
  }

  async function removeAlertRule(id: string) {
    try {
      await deleteAlert(id);
      setAlertRules((prev) => prev.filter((rule) => rule.id !== id));
    } catch {
      setError(t("app.unableDeleteAlert"));
    }
  }

  return (
    <main className="min-h-screen bg-paper p-4 text-ink md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-sky-900 to-cyan-700 p-6 text-white shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold md:text-3xl">{t("app.title")}</h1>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
              <label className="mr-2">{t("app.language")}</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="rounded-md border border-white/30 bg-transparent px-2 py-1"
              >
                <option value="en" className="text-ink">
                  EN
                </option>
                <option value="id" className="text-ink">
                  ID
                </option>
                <option value="th" className="text-ink">
                  TH
                </option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-sm text-cyan-100">{t("app.subtitle")}</p>
        </header>

        <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-soft md:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-wrap gap-2">
            {sortedWatchlist.map((item) => (
              <button
                key={`${item.assetClass}-${item.symbol}`}
                onClick={() => setSelected(item)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  selected?.symbol === item.symbol &&
                  selected.assetClass === item.assetClass
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {item.symbol}{" "}
                {item.assetClass === "crypto"
                  ? t("common.crypto").toUpperCase()
                  : t("common.stock").toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {timeframes.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder={t("common.symbol")}
            />
            <select
              value={assetClassInput}
              onChange={(e) => setAssetClassInput(e.target.value as AssetClass)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="stock">{t("common.stock")}</option>
              <option value="crypto">{t("common.crypto")}</option>
            </select>
            <button
              onClick={addCustomAsset}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white"
            >
              {t("common.add")}
            </button>
          </div>
        </section>

        {loading && (
          <p className="rounded-xl bg-white p-4 shadow-soft">
            {t("app.loadingAnalysis")}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-negative/10 p-4 text-negative">{error}</p>
        )}

        {selected && (
          <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-soft md:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <p className="text-xs uppercase text-slate-500">
                {t("app.livePrice")}
              </p>
              <p className="text-xl font-bold text-ink">
                {liveQuote
                  ? formatNullableNumber(liveQuote.price)
                  : formatNullableNumber(analysis?.quote.price)}
              </p>
            </div>
            <select
              value={alertDirection}
              onChange={(e) =>
                setAlertDirection(e.target.value as "above" | "below")
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="above">{t("common.above")}</option>
              <option value="below">{t("common.below")}</option>
            </select>
            <input
              value={alertTargetPrice}
              onChange={(e) => setAlertTargetPrice(e.target.value)}
              placeholder={t("common.targetPrice")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              onClick={addAlertRule}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white"
            >
              {t("common.createAlert")}
            </button>
          </section>
        )}

        {!loading && analysis && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <PricePanel analysis={analysis} />
              <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft">
                <p className="text-sm text-slate-600">
                  {t("app.strategyUpdated", {
                    ago: formatAgo(strategyUpdatedAt, clockMs, t),
                  })}
                </p>
                {newsShock && clockMs - newsShock.atMs <= 120_000 && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      newsShock.direction === "up"
                        ? "bg-positive/15 text-positive"
                        : "bg-negative/15 text-negative"
                    }`}
                  >
                    {newsShock.direction === "up"
                      ? t("app.newsShockUp", {
                          delta: newsShock.delta.toFixed(1),
                        })
                      : t("app.newsShockDown", {
                          delta: newsShock.delta.toFixed(1),
                        })}
                  </span>
                )}
              </section>
              <PriceChart analysis={analysis} />
              <NewsPanel analysis={analysis} />
              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="mb-3 text-lg font-semibold text-ink">
                  {t("app.alertRules")}
                </h2>
                <div className="space-y-2">
                  {alertRules
                    .filter(
                      (rule) =>
                        rule.symbol === analysis.symbol &&
                        rule.assetClass === analysis.assetClass,
                    )
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                      >
                        <p className="text-sm text-slate-700">
                          {rule.direction.toUpperCase()} {rule.targetPrice}{" "}
                          {rule.active
                            ? `(${t("common.active")})`
                            : `(${t("common.triggered")})`}
                        </p>
                        <button
                          onClick={() => removeAlertRule(rule.id)}
                          className="text-xs font-semibold text-negative"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            </div>
            <div className="space-y-4">
              <DecisionCard analysis={analysis} />
              <SignalSummary analysis={analysis} />
              <AutoInvestmentPlan
                symbol={analysis.symbol}
                assetClass={analysis.assetClass}
                timeframe={timeframe}
              />
              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="mb-3 text-lg font-semibold text-ink">
                  {t("app.triggeredAlerts")}
                </h2>
                <div className="space-y-2">
                  {triggeredAlerts.slice(0, 6).map((event) => (
                    <div
                      key={`${event.alertId}-${event.triggeredAt}`}
                      className="rounded-xl bg-paper px-3 py-2 text-sm text-slate-700"
                    >
                      {event.alertType === "signal"
                        ? `${event.symbol} signal changed: ${event.previousSignal} -> ${event.newSignal}`
                        : `${event.symbol} ${event.direction.toUpperCase()} ${event.targetPrice} hit at ${event.triggerPrice}`}
                    </div>
                  ))}
                  {triggeredAlerts.length === 0 && (
                    <p className="text-sm text-slate-500">
                      {t("app.noAlertTriggered")}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="mb-3 text-lg font-semibold text-ink">
                  {t("app.strategyHistory")}
                </h2>
                <div className="space-y-2">
                  {strategyHistory.slice(0, 10).map((item) => (
                    <div
                      key={`${item.symbol}-${item.timestamp}-${item.decision.tradeSignal}`}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-ink">
                          {item.decision.tradeSignal}
                        </span>
                        <span className="text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        final {item.finalScore.toFixed(1)} | news{" "}
                        {item.newsScore.toFixed(1)} | risk{" "}
                        {item.riskScore.toFixed(1)}
                      </p>
                    </div>
                  ))}
                  {strategyHistory.length === 0 && (
                    <p className="text-sm text-slate-500">
                      {t("app.noStrategyHistory")}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        <footer className="rounded-xl bg-white p-4 text-center text-sm text-slate-600 shadow-soft">
          {t("app.footer")}
        </footer>
      </div>
    </main>
  );
}
