import type {
  AssetClass,
  Quote,
  StrategyHistoryEntry,
  Timeframe,
  TradeSignal,
  TriggeredAlert,
} from "../types.js";
import { recordTriggeredAlert } from "./alertsStore.js";
import type { StrategySnapshot } from "./analysisService.js";

const STRATEGY_HISTORY_LIMIT = 50;

const historyByKey = new Map<string, StrategyHistoryEntry[]>();
const latestSignalByKey = new Map<string, TradeSignal>();

function strategyKey(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
): string {
  return `${symbol.toUpperCase()}|${assetClass}|${timeframe}`;
}

export function isMarketOn(quote: Pick<Quote, "marketStatus">): boolean {
  return quote.marketStatus !== "closed";
}

export function pushStrategyUpdate(input: {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  quotePrice: number;
  timestamp: string;
  snapshot: StrategySnapshot;
}): { entry: StrategyHistoryEntry; signalAlert?: TriggeredAlert } {
  const symbol = input.symbol.toUpperCase();
  const key = strategyKey(symbol, input.assetClass, input.timeframe);
  const entry: StrategyHistoryEntry = {
    symbol,
    assetClass: input.assetClass,
    timeframe: input.timeframe,
    quotePrice: input.quotePrice,
    technicalScore: input.snapshot.technicalScore,
    newsScore: input.snapshot.newsScore,
    riskScore: input.snapshot.riskScore,
    finalScore: input.snapshot.finalScore,
    decision: input.snapshot.decision,
    sourceConfidence: input.snapshot.newsSummary.sourceConfidence,
    timestamp: input.timestamp,
  };

  const bucket = historyByKey.get(key) ?? [];
  bucket.push(entry);
  if (bucket.length > STRATEGY_HISTORY_LIMIT) {
    bucket.splice(0, bucket.length - STRATEGY_HISTORY_LIMIT);
  }
  historyByKey.set(key, bucket);

  const previousSignal = latestSignalByKey.get(key);
  const nextSignal = entry.decision.tradeSignal;
  latestSignalByKey.set(key, nextSignal);

  let signalAlert: TriggeredAlert | undefined;
  const isTradeNowSignal =
    nextSignal === "BUY_NOW" || nextSignal === "SELL_NOW";
  if (isTradeNowSignal && previousSignal && previousSignal !== nextSignal) {
    signalAlert = {
      alertId: `signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      alertType: "signal",
      symbol,
      assetClass: input.assetClass,
      direction: nextSignal === "BUY_NOW" ? "above" : "below",
      targetPrice: input.quotePrice,
      triggerPrice: input.quotePrice,
      previousSignal,
      newSignal: nextSignal,
      message: `Signal changed from ${previousSignal} to ${nextSignal}.`,
      triggeredAt: input.timestamp,
    };
    recordTriggeredAlert(signalAlert);
  }

  return { entry, signalAlert };
}

export function getStrategyHistory(params: {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  limit?: number;
}): StrategyHistoryEntry[] {
  const key = strategyKey(params.symbol, params.assetClass, params.timeframe);
  const bucket = historyByKey.get(key) ?? [];
  const limit = params.limit ?? STRATEGY_HISTORY_LIMIT;
  return bucket.slice(-limit).reverse();
}
