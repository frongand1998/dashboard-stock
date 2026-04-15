export type AssetClass = "stock" | "crypto";
export type Timeframe = "15m" | "1h" | "4h" | "1d";

export interface WatchlistItem {
  symbol: string;
  assetClass: AssetClass;
}

export interface LiveQuote {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  changePercent24h: number;
  volume24h: number;
  volatility: number;
  marketStatus: string;
  delayMinutes: number;
  source: string;
  timestamp: string;
}

export interface AlertRule {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  direction: "above" | "below";
  targetPrice: number;
  createdAt: string;
  active: boolean;
}

export interface TriggeredAlert {
  alertId: string;
  alertType?: "price" | "signal";
  symbol: string;
  assetClass: AssetClass;
  direction: "above" | "below";
  targetPrice: number;
  triggerPrice: number;
  previousSignal?: "BUY_NOW" | "HOLD" | "WAIT" | "AVOID" | "SELL_NOW";
  newSignal?: "BUY_NOW" | "HOLD" | "WAIT" | "AVOID" | "SELL_NOW";
  message?: string;
  triggeredAt: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisResponse {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  quote: {
    price: number;
    changePercent24h: number;
    volume24h: number;
    volatility: number;
    marketStatus: string;
    delayMinutes: number;
    source: string;
    timestamp: string;
  };
  candles: Candle[];
  indicators: {
    sma20: number;
    sma50: number;
    sma200: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    atr14: number;
    support: number;
    resistance: number;
  };
  technicalScore: number;
  newsScore: number;
  riskScore: number;
  finalScore: number;
  newsSummary: {
    stance: "bullish" | "neutral" | "bearish";
    impact: "low" | "medium" | "high";
    sourceConfidence: Array<{
      source: string;
      confidence: number;
      sampleSize: number;
    }>;
    items: Array<{
      id: string;
      title: string;
      source: string;
      url: string;
      publishedAt: string;
      sentiment: number;
      relevance: number;
      tags: string[];
      sourceConfidence?: number;
    }>;
  };
  decision: {
    action: "BUY" | "WAIT" | "AVOID";
    tradeSignal: "BUY_NOW" | "HOLD" | "WAIT" | "AVOID" | "SELL_NOW";
    riskGuardrailTriggered: boolean;
    buyRange: { low: number; high: number };
    sellRange: { low: number; high: number };
    holdUntilConditions: string[];
    confidence: number;
    reasonsTop3: string[];
    uncertaintyNotes: string[];
    contradictionWarning?: string;
  };
  dataSource: {
    provider: string;
    delayed: boolean;
    delayMinutes: number;
  };
  timestamp: string;
}

export type StrategyStreamEvent = Pick<
  AnalysisResponse,
  | "symbol"
  | "assetClass"
  | "timeframe"
  | "indicators"
  | "technicalScore"
  | "newsScore"
  | "riskScore"
  | "finalScore"
  | "newsSummary"
  | "decision"
  | "timestamp"
>;

export interface StrategyHistoryItem {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  quotePrice: number;
  technicalScore: number;
  newsScore: number;
  riskScore: number;
  finalScore: number;
  sourceConfidence: Array<{
    source: string;
    confidence: number;
    sampleSize: number;
  }>;
  decision: AnalysisResponse["decision"];
  timestamp: string;
}

export type PlanTheme = "now" | "war" | "ai" | "custom";

export interface InvestmentPlan {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  theme: PlanTheme;
  planName: string;
  generatedAt: string;
  tradeSignal: "BUY_NOW" | "HOLD" | "WAIT" | "AVOID" | "SELL_NOW";
  confidence: number;
  actionNow: string;
  summary: string;
  entries: Array<{
    label: string;
    allocationPercent: number;
    rationale: string;
  }>;
  executionChecklist: string[];
  riskRules: string[];
  reviewCadence: string;
}

export interface PlanHistoryEntry {
  id: string;
  plan: InvestmentPlan;
}
