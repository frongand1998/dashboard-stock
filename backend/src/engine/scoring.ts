import type {
  IndicatorSet,
  NewsItem,
  Quote,
  SourceConfidence,
} from "../types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildSourceConfidence(news: NewsItem[]): SourceConfidence[] {
  const grouped = new Map<string, number[]>();
  for (const item of news) {
    const key = item.source?.trim() || "unknown";
    const bucket = grouped.get(key) ?? [];
    bucket.push(item.sentiment);
    grouped.set(key, bucket);
  }

  const confidences: SourceConfidence[] = [];
  for (const [source, sentiments] of grouped.entries()) {
    const sampleSize = sentiments.length;
    const mean = sentiments.reduce((sum, n) => sum + n, 0) / sampleSize;
    const variance =
      sentiments.reduce((sum, n) => sum + (n - mean) ** 2, 0) / sampleSize;
    const stdDev = Math.sqrt(variance);
    const consistency = clamp01(1 - stdDev / 0.85);
    const sampleBoost = Math.min(0.25, sampleSize * 0.03);
    const extremePenalty = Math.abs(mean) > 0.8 && sampleSize < 3 ? 0.15 : 0;

    let confidence = clamp01(
      0.45 + consistency * 0.35 + sampleBoost - extremePenalty,
    );
    if (source.toLowerCase().includes("mock")) confidence *= 0.7;

    confidences.push({
      source,
      confidence: Number(confidence.toFixed(2)),
      sampleSize,
    });
  }

  return confidences.sort((a, b) => b.confidence - a.confidence);
}

export function scoreTechnical(
  indicators: IndicatorSet,
  quote: Quote,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (quote.price > indicators.sma50) {
    score += 10;
    reasons.push("Price is above SMA50 trend filter.");
  } else {
    score -= 10;
    reasons.push("Price is below SMA50 trend filter.");
  }

  if (quote.price > indicators.sma200) {
    score += 8;
    reasons.push("Long-term trend remains above SMA200.");
  } else {
    score -= 8;
    reasons.push("Long-term trend is weaker than SMA200.");
  }

  if (indicators.rsi14 < 35) {
    score += 10;
    reasons.push("RSI suggests oversold conditions.");
  } else if (indicators.rsi14 > 70) {
    score -= 10;
    reasons.push("RSI suggests overbought conditions.");
  }

  if (indicators.macd > indicators.macdSignal) {
    score += 8;
    reasons.push("MACD is in bullish crossover state.");
  } else {
    score -= 8;
    reasons.push("MACD is in bearish crossover state.");
  }

  const nearSupport =
    Math.abs(quote.price - indicators.support) / quote.price < 0.02;
  const nearResistance =
    Math.abs(quote.price - indicators.resistance) / quote.price < 0.02;

  if (nearSupport) {
    score += 7;
    reasons.push("Price is near support zone.");
  }

  if (nearResistance) {
    score -= 7;
    reasons.push("Price is near resistance zone.");
  }

  return { score: clamp(score), reasons };
}

export function scoreNews(news: NewsItem[]): {
  score: number;
  normalizedSentiment: number;
  sourceConfidence: SourceConfidence[];
  weightedItems: NewsItem[];
  reasons: string[];
  contradictionRisk: boolean;
} {
  if (news.length === 0) {
    return {
      score: 50,
      normalizedSentiment: 0,
      sourceConfidence: [],
      weightedItems: [],
      reasons: ["No recent news, sentiment is neutral by default."],
      contradictionRisk: false,
    };
  }

  const sourceConfidence = buildSourceConfidence(news);
  const sourceConfidenceMap = new Map(
    sourceConfidence.map((item) => [item.source, item.confidence]),
  );

  const now = Date.now();
  let weighted = 0;
  let totalWeight = 0;
  const weightedItems: NewsItem[] = [];

  for (const item of news) {
    const ageHours =
      (now - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
    // Faster decay keeps strategy more reactive when sentiment shifts quickly.
    const halfLifeHours = 8;
    const timeDecay = Math.max(0.05, Math.pow(0.5, ageHours / halfLifeHours));
    const breakingBoost = ageHours <= 2 ? 1.35 : ageHours <= 6 ? 1.15 : 1;
    const sourceWeight = item.source.includes("mock") ? 0.8 : 1;
    const confidence = sourceConfidenceMap.get(item.source) ?? 0.6;
    const weight =
      item.relevance * timeDecay * sourceWeight * breakingBoost * confidence;
    weighted += item.sentiment * weight;
    totalWeight += weight;

    weightedItems.push({
      ...item,
      sourceConfidence: Number(confidence.toFixed(2)),
    });
  }

  const normalized = totalWeight === 0 ? 0 : weighted / totalWeight;
  const score = clamp(50 + normalized * 45);
  const reasons = [
    `News sentiment aggregate is ${normalized.toFixed(2)} with fast time decay and breaking-news boost.`,
    "Very recent high-relevance headlines are weighted most heavily.",
    "Lower-confidence sources are automatically downweighted.",
  ];

  return {
    score,
    normalizedSentiment: normalized,
    sourceConfidence,
    weightedItems,
    reasons,
    contradictionRisk: normalized < -0.4,
  };
}

export function scoreRisk(
  quote: Quote,
  indicators: IndicatorSet,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 80;

  if (quote.volatility > 0.06) {
    score -= 18;
    reasons.push("High volatility regime detected.");
  }

  const atrRatio = indicators.atr14 / Math.max(quote.price, 0.0001);
  if (atrRatio > 0.04) {
    score -= 14;
    reasons.push("ATR relative to price implies wider risk bands.");
  } else {
    reasons.push("ATR relative to price remains manageable.");
  }

  if (quote.delayMinutes > 0) {
    score -= Math.min(10, quote.delayMinutes);
    reasons.push("Data is delayed, reducing confidence.");
  }

  return { score: clamp(score), reasons };
}

export function combineScores(
  technical: number,
  news: number,
  risk: number,
  weights = { technical: 0.5, news: 0.3, risk: 0.2 },
): number {
  return clamp(
    technical * weights.technical + news * weights.news + risk * weights.risk,
  );
}
