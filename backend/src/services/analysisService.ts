import { computeIndicators } from "../engine/indicators.js";
import { buildDecision } from "../engine/decision.js";
import {
  combineScores,
  scoreNews,
  scoreRisk,
  scoreTechnical,
} from "../engine/scoring.js";
import type {
  AnalysisResponse,
  AssetClass,
  Candle,
  DecisionOutput,
  IndicatorSet,
  NewsItem,
  Quote,
  Timeframe,
} from "../types.js";
import { createProvider } from "../adapters/providerRegistry.js";

export interface StrategySnapshot {
  indicators: IndicatorSet;
  technicalScore: number;
  newsScore: number;
  riskScore: number;
  finalScore: number;
  newsSummary: AnalysisResponse["newsSummary"];
  decision: DecisionOutput;
}

export function buildStrategySnapshot(
  quote: Quote,
  candles: Candle[],
  news: NewsItem[],
): StrategySnapshot {
  const indicators = computeIndicators(candles);
  const technical = scoreTechnical(indicators, quote);
  const newsScore = scoreNews(news);
  const risk = scoreRisk(quote, indicators);
  const finalScore = combineScores(
    technical.score,
    newsScore.score,
    risk.score,
  );

  const contradictionWarning =
    technical.score > 65 && newsScore.score < 40
      ? "Technical momentum is positive but news sentiment is meaningfully negative."
      : undefined;

  const uncertaintyNotes = [
    quote.delayMinutes > 0
      ? `Data delay is ${quote.delayMinutes} minutes.`
      : "Data feed is near real-time.",
    "Free-tier providers can be rate-limited and partially delayed.",
    "This output is educational and should be validated with independent research.",
  ];

  const decision = buildDecision(
    finalScore,
    quote,
    indicators,
    [...technical.reasons, ...newsScore.reasons, ...risk.reasons],
    uncertaintyNotes,
    contradictionWarning,
  );

  const pulse = newsScore.normalizedSentiment;
  const stance = pulse > 0.2 ? "bullish" : pulse < -0.2 ? "bearish" : "neutral";
  const impact =
    Math.abs(pulse) > 0.5 ? "high" : Math.abs(pulse) > 0.25 ? "medium" : "low";

  return {
    indicators,
    technicalScore: Number(technical.score.toFixed(1)),
    newsScore: Number(newsScore.score.toFixed(1)),
    riskScore: Number(risk.score.toFixed(1)),
    finalScore: Number(finalScore.toFixed(1)),
    newsSummary: {
      stance,
      impact,
      items: newsScore.weightedItems,
      sourceConfidence: newsScore.sourceConfidence,
    },
    decision,
  };
}

export async function analyzeAsset(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
): Promise<AnalysisResponse> {
  const provider = createProvider();

  const [quote, candles, news] = await Promise.all([
    provider.getQuote(symbol, assetClass),
    provider.getCandles(symbol, timeframe, assetClass),
    provider.getNews(symbol, assetClass),
  ]);
  const snapshot = buildStrategySnapshot(quote, candles, news);

  return {
    symbol,
    assetClass,
    timeframe,
    quote,
    candles,
    indicators: snapshot.indicators,
    technicalScore: snapshot.technicalScore,
    newsScore: snapshot.newsScore,
    riskScore: snapshot.riskScore,
    finalScore: snapshot.finalScore,
    newsSummary: snapshot.newsSummary,
    decision: snapshot.decision,
    dataSource: {
      provider: provider.name,
      delayed: quote.delayMinutes > 0,
      delayMinutes: quote.delayMinutes,
    },
    timestamp: new Date().toISOString(),
  };
}

export const seedWatchlist = [
  { symbol: "NVDA", assetClass: "stock" },
  { symbol: "AMD", assetClass: "stock" },
  { symbol: "INTC", assetClass: "stock" },
  { symbol: "LRCX", assetClass: "stock" },
  { symbol: "TSM", assetClass: "stock" },
  { symbol: "ASML", assetClass: "stock" },
  { symbol: "LAC", assetClass: "stock" },
  { symbol: "LAR", assetClass: "stock" },
] as const;
