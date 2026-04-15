import { createProvider } from "../adapters/providerRegistry.js";
import type { Timeframe } from "../types.js";
import { buildStrategySnapshot, seedWatchlist } from "./analysisService.js";
import { isMarketOn, pushStrategyUpdate } from "./strategyStore.js";

let refreshTimer: NodeJS.Timeout | null = null;
let inFlight = false;

export function startWatchlistStrategyRefresh(
  timeframe: Timeframe = "1h",
  intervalMs = 45_000,
): void {
  if (refreshTimer) return;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;

    try {
      const provider = createProvider();
      for (const item of seedWatchlist) {
        try {
          const [quote, candles, news] = await Promise.all([
            provider.getQuote(item.symbol, item.assetClass),
            provider.getCandles(item.symbol, timeframe, item.assetClass),
            provider.getNews(item.symbol, item.assetClass),
          ]);

          const snapshot = buildStrategySnapshot(quote, candles, news);
          if (isMarketOn(quote)) {
            pushStrategyUpdate({
              symbol: item.symbol,
              assetClass: item.assetClass,
              timeframe,
              quotePrice: quote.price,
              timestamp: new Date().toISOString(),
              snapshot,
            });
          }
        } catch {
          // Keep refresh loop resilient when one symbol fails.
        }
      }
    } finally {
      inFlight = false;
    }
  };

  void tick();
  refreshTimer = setInterval(() => {
    void tick();
  }, intervalMs);
}
