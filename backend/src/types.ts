export type AssetClass = "stock" | "crypto";
export type Timeframe = "15m" | "1h" | "4h" | "1d";

export interface Quote {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  changePercent24h: number;
  volume24h: number;
  volatility: number;
  marketStatus: "open" | "closed" | "always_open";
  delayMinutes: number;
  source: string;
  timestamp: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: number;
  relevance: number;
  tags: string[];
  sourceConfidence?: number;
}

export interface SourceConfidence {
  source: string;
  confidence: number;
  sampleSize: number;
}

export interface Fundamentals {
  marketCap?: number;
  peRatio?: number;
  circulatingSupply?: number;
}

export interface DataProvider {
  name: string;
  getQuote(symbol: string, assetClass: AssetClass): Promise<Quote>;
  getCandles(
    symbol: string,
    timeframe: Timeframe,
    assetClass: AssetClass,
  ): Promise<Candle[]>;
  streamQuote(
    symbol: string,
    assetClass: AssetClass,
    onTick: (quote: Quote) => void,
  ): Promise<() => void>;
  getNews(symbol: string, assetClass: AssetClass): Promise<NewsItem[]>;
  getFundamentalsOrOnChain(
    symbol: string,
    assetClass: AssetClass,
  ): Promise<Fundamentals>;
}

export interface IndicatorSet {
  sma20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  atr14: number;
  support: number;
  resistance: number;
}

export type TradeSignal = "BUY_NOW" | "HOLD" | "WAIT" | "AVOID" | "SELL_NOW";

export interface DecisionOutput {
  action: "BUY" | "WAIT" | "AVOID";
  tradeSignal: TradeSignal;
  riskGuardrailTriggered: boolean;
  buyRange: { low: number; high: number };
  sellRange: { low: number; high: number };
  holdUntilConditions: string[];
  confidence: number;
  reasonsTop3: string[];
  uncertaintyNotes: string[];
  contradictionWarning?: string;
}

export interface AnalysisResponse {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  quote: Quote;
  candles: Candle[];
  indicators: IndicatorSet;
  technicalScore: number;
  newsScore: number;
  riskScore: number;
  finalScore: number;
  newsSummary: {
    stance: "bullish" | "neutral" | "bearish";
    impact: "low" | "medium" | "high";
    items: NewsItem[];
    sourceConfidence: SourceConfidence[];
  };
  decision: DecisionOutput;
  dataSource: {
    provider: string;
    delayed: boolean;
    delayMinutes: number;
  };
  timestamp: string;
}

export type AlertDirection = "above" | "below";

export interface AlertRule {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  direction: AlertDirection;
  targetPrice: number;
  createdAt: string;
  active: boolean;
}

export interface TriggeredAlert {
  alertId: string;
  alertType?: "price" | "signal";
  symbol: string;
  assetClass: AssetClass;
  direction: AlertDirection;
  targetPrice: number;
  triggerPrice: number;
  previousSignal?: TradeSignal;
  newSignal?: TradeSignal;
  message?: string;
  triggeredAt: string;
}

export interface StrategyHistoryEntry {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  quotePrice: number;
  technicalScore: number;
  newsScore: number;
  riskScore: number;
  finalScore: number;
  decision: DecisionOutput;
  sourceConfidence: SourceConfidence[];
  timestamp: string;
}

export type PlanTheme = "now" | "war" | "ai" | "custom";

export interface InvestmentPlanStep {
  label: string;
  allocationPercent: number;
  rationale: string;
}

export interface InvestmentPlan {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  theme: PlanTheme;
  planName: string;
  generatedAt: string;
  tradeSignal: TradeSignal;
  confidence: number;
  actionNow: string;
  summary: string;
  entries: InvestmentPlanStep[];
  executionChecklist: string[];
  riskRules: string[];
  reviewCadence: string;
}

export interface PlanHistoryEntry {
  id: string;
  plan: InvestmentPlan;
}
