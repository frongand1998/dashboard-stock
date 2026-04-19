import { useEffect, useMemo, useState } from "react";
import type { AssetClass } from "../types/analysis";

type SuggestionSignal = "BUY_NOW" | "SELL_NOW";

export interface TodaySuggestionItem {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  lotPrice: number;
  signal: SuggestionSignal;
  finalScore: number;
  confidence: number;
  changePercent24h: number;
  buyPowerPerLot: number;
  updatedAt: string;
}

type SortMode =
  | "most_buy_today"
  | "most_sell_today"
  | "most_buy_per_lot_today"
  | "trend_up_today"
  | "trend_down_today";

type SignalFilter = "all" | SuggestionSignal;
type MobileCardMode = "compact" | "detailed";

interface Props {
  title: string;
  subtitle: string;
  loadingLabel: string;
  emptyLabel: string;
  noStockLabel: string;
  symbolLabel: string;
  actionLabel: string;
  priceLabel: string;
  scoreLabel: string;
  confidenceLabel: string;
  updatedLabel: string;
  lotPriceLabel: string;
  changeLabel: string;
  buyPowerPerLotLabel: string;
  viewLabel: string;
  buyLabel: string;
  sellLabel: string;
  sortLabel: string;
  filterLabel: string;
  perPageLabel: string;
  pageLabel: string;
  pagePrevLabel: string;
  pageNextLabel: string;
  sortMostBuyLabel: string;
  sortMostSellLabel: string;
  sortMostBuyPerLotLabel: string;
  sortTrendUpLabel: string;
  sortTrendDownLabel: string;
  filterAllLabel: string;
  filterBuyLabel: string;
  filterSellLabel: string;
  mobileViewLabel: string;
  compactLabel: string;
  detailedLabel: string;
  items: TodaySuggestionItem[];
  hasStockInWatchlist: boolean;
  loading: boolean;
  error: string | null;
  onPick: (symbol: string, assetClass: AssetClass) => void;
}

export function TodaySuggestionsSection({
  title,
  subtitle,
  loadingLabel,
  emptyLabel,
  noStockLabel,
  symbolLabel,
  actionLabel,
  priceLabel,
  scoreLabel,
  confidenceLabel,
  updatedLabel,
  lotPriceLabel,
  changeLabel,
  buyPowerPerLotLabel,
  viewLabel,
  buyLabel,
  sellLabel,
  sortLabel,
  filterLabel,
  perPageLabel,
  pageLabel,
  pagePrevLabel,
  pageNextLabel,
  sortMostBuyLabel,
  sortMostSellLabel,
  sortMostBuyPerLotLabel,
  sortTrendUpLabel,
  sortTrendDownLabel,
  filterAllLabel,
  filterBuyLabel,
  filterSellLabel,
  mobileViewLabel,
  compactLabel,
  detailedLabel,
  items,
  hasStockInWatchlist,
  loading,
  error,
  onPick,
}: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("most_buy_today");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [mobileCardMode, setMobileCardMode] =
    useState<MobileCardMode>("compact");
  const [perPage, setPerPage] = useState(5);
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(
    () =>
      signalFilter === "all"
        ? items
        : items.filter((item) => item.signal === signalFilter),
    [items, signalFilter],
  );

  const sortedItems = useMemo(() => {
    const next = [...filteredItems];
    if (sortMode === "most_buy_today") {
      next.sort((a, b) => {
        if (a.signal !== b.signal) return a.signal === "BUY_NOW" ? -1 : 1;
        return b.finalScore - a.finalScore || b.confidence - a.confidence;
      });
      return next;
    }

    if (sortMode === "most_sell_today") {
      next.sort((a, b) => {
        if (a.signal !== b.signal) return a.signal === "SELL_NOW" ? -1 : 1;
        return a.finalScore - b.finalScore || b.confidence - a.confidence;
      });
      return next;
    }

    if (sortMode === "most_buy_per_lot_today") {
      next.sort((a, b) => b.buyPowerPerLot - a.buyPowerPerLot);
      return next;
    }

    if (sortMode === "trend_up_today") {
      next.sort((a, b) => b.changePercent24h - a.changePercent24h);
      return next;
    }

    next.sort((a, b) => a.changePercent24h - b.changePercent24h);
    return next;
  }, [filteredItems, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / perPage));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [perPage, signalFilter, sortMode]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedItems.slice(start, start + perPage);
  }, [page, perPage, sortedItems]);

  const formatMoney = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="sticky top-2 z-10 grid w-full gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 text-xs text-slate-600 shadow-sm backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none sm:grid-cols-3 sm:text-sm">
            <label className="flex items-center justify-between gap-1.5 sm:justify-start">
              <span>{sortLabel}</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-w-0 rounded-lg border border-slate-200 px-2 py-1.5"
              >
                <option value="most_buy_today">{sortMostBuyLabel}</option>
                <option value="most_sell_today">{sortMostSellLabel}</option>
                <option value="most_buy_per_lot_today">
                  {sortMostBuyPerLotLabel}
                </option>
                <option value="trend_up_today">{sortTrendUpLabel}</option>
                <option value="trend_down_today">{sortTrendDownLabel}</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-1.5 sm:justify-start">
              <span>{filterLabel}</span>
              <select
                value={signalFilter}
                onChange={(e) =>
                  setSignalFilter(e.target.value as SignalFilter)
                }
                className="min-w-0 rounded-lg border border-slate-200 px-2 py-1.5"
              >
                <option value="all">{filterAllLabel}</option>
                <option value="BUY_NOW">{filterBuyLabel}</option>
                <option value="SELL_NOW">{filterSellLabel}</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-1.5 sm:justify-start">
              <span>{perPageLabel}</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="min-w-0 rounded-lg border border-slate-200 px-2 py-1.5"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>

            <div className="col-span-full flex items-center justify-between gap-2 md:hidden">
              <span>{mobileViewLabel}</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setMobileCardMode("compact")}
                  className={`rounded-md px-2 py-1 font-semibold ${
                    mobileCardMode === "compact"
                      ? "bg-accent text-white"
                      : "text-slate-600"
                  }`}
                >
                  {compactLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCardMode("detailed")}
                  className={`rounded-md px-2 py-1 font-semibold ${
                    mobileCardMode === "detailed"
                      ? "bg-accent text-white"
                      : "text-slate-600"
                  }`}
                >
                  {detailedLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">{loadingLabel}</p>}

      {!loading && error && (
        <p className="rounded-xl bg-negative/10 p-3 text-sm text-negative">
          {error}
        </p>
      )}

      {!loading && !error && !hasStockInWatchlist && (
        <p className="text-sm text-slate-500">{noStockLabel}</p>
      )}

      {!loading && !error && hasStockInWatchlist && items.length === 0 && (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      )}

      {!loading && !error && sortedItems.length > 0 && (
        <div>
          <div className="space-y-3 md:hidden">
            {paginatedItems.map((item) => (
              <article
                key={`${item.symbol}-${item.signal}-${item.updatedAt}`}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-ink">
                    {item.symbol}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${
                      item.signal === "BUY_NOW"
                        ? "bg-positive/15 text-positive"
                        : "bg-negative/15 text-negative"
                    }`}
                  >
                    {item.signal === "BUY_NOW" ? buyLabel : sellLabel}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-paper p-2">
                    <p className="text-slate-500">{priceLabel}</p>
                    <p className="font-semibold text-ink">
                      {formatMoney(item.price)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-paper p-2">
                    <p className="text-slate-500">{lotPriceLabel}</p>
                    <p className="font-semibold text-ink">
                      {formatMoney(item.lotPrice)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-paper p-2">
                    <p className="text-slate-500">{scoreLabel}</p>
                    <p className="font-semibold text-ink">
                      {item.finalScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-paper p-2">
                    <p className="text-slate-500">{confidenceLabel}</p>
                    <p className="font-semibold text-ink">
                      {Math.round(item.confidence)}%
                    </p>
                  </div>
                  {mobileCardMode === "detailed" && (
                    <>
                      <div className="rounded-lg bg-paper p-2">
                        <p className="text-slate-500">{buyPowerPerLotLabel}</p>
                        <p className="font-semibold text-ink">
                          {item.buyPowerPerLot.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-paper p-2">
                        <p className="text-slate-500">{updatedLabel}</p>
                        <p className="font-semibold text-ink">
                          {new Date(item.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <p
                    className={
                      item.changePercent24h >= 0
                        ? "text-positive"
                        : "text-negative"
                    }
                  >
                    {changeLabel}: {item.changePercent24h >= 0 ? "+" : ""}
                    {item.changePercent24h.toFixed(2)}%
                  </p>
                  <button
                    onClick={() => onPick(item.symbol, item.assetClass)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700"
                  >
                    {viewLabel}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">{symbolLabel}</th>
                  <th className="px-3 py-2">{actionLabel}</th>
                  <th className="px-3 py-2">{priceLabel}</th>
                  <th className="px-3 py-2">{lotPriceLabel}</th>
                  <th className="px-3 py-2">{scoreLabel}</th>
                  <th className="px-3 py-2">{confidenceLabel}</th>
                  <th className="px-3 py-2">{changeLabel}</th>
                  <th className="px-3 py-2">{buyPowerPerLotLabel}</th>
                  <th className="px-3 py-2">{updatedLabel}</th>
                  <th className="px-3 py-2" aria-label={viewLabel} />
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr
                    key={`${item.symbol}-${item.signal}-${item.updatedAt}`}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-3 py-3 font-semibold text-ink">
                      {item.symbol}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${
                          item.signal === "BUY_NOW"
                            ? "bg-positive/15 text-positive"
                            : "bg-negative/15 text-negative"
                        }`}
                      >
                        {item.signal === "BUY_NOW" ? buyLabel : sellLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {formatMoney(item.price)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {formatMoney(item.lotPrice)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.finalScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {Math.round(item.confidence)}%
                    </td>
                    <td
                      className={`px-3 py-3 ${item.changePercent24h >= 0 ? "text-positive" : "text-negative"}`}
                    >
                      {item.changePercent24h >= 0 ? "+" : ""}
                      {item.changePercent24h.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.buyPowerPerLot.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(item.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onPick(item.symbol, item.assetClass)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {viewLabel}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600 sm:text-sm">
            <p>
              {pageLabel}: {page}/{totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pagePrevLabel}
              </button>
              <button
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pageNextLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
