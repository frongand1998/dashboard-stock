import type {
  AlertRule,
  AnalysisResponse,
  AssetClass,
  InvestmentPlan,
  PlanHistoryEntry,
  LiveQuote,
  PlanTheme,
  StrategyHistoryItem,
  StrategyStreamEvent,
  Timeframe,
  TriggeredAlert,
  WatchlistItem,
} from "../types/analysis";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "NVDA", assetClass: "stock" },
  { symbol: "AMD", assetClass: "stock" },
  { symbol: "INTC", assetClass: "stock" },
  { symbol: "LRCX", assetClass: "stock" },
  { symbol: "TSM", assetClass: "stock" },
  { symbol: "ASML", assetClass: "stock" },
  { symbol: "LAC", assetClass: "stock" },
  { symbol: "LAR", assetClass: "stock" },
];

export async function getWatchlist(): Promise<WatchlistItem[]> {
  try {
    const res = await fetch(`${API_BASE}/watchlist`);
    if (!res.ok) return DEFAULT_WATCHLIST;

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.length > 0 ? items : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export async function getAnalysis(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
): Promise<AnalysisResponse> {
  const query = new URLSearchParams({ symbol, assetClass, timeframe });
  const res = await fetch(`${API_BASE}/analyze?${query.toString()}`);
  if (!res.ok) throw new Error("Unable to load analysis");
  return res.json();
}

export async function getAlerts(): Promise<{
  rules: AlertRule[];
  triggered: TriggeredAlert[];
}> {
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error("Unable to load alerts");
  return res.json();
}

export async function getStrategyHistory(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
  limit = 50,
): Promise<StrategyHistoryItem[]> {
  const query = new URLSearchParams({
    symbol,
    assetClass,
    timeframe,
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/strategy/history?${query.toString()}`);
  if (!res.ok) throw new Error("Unable to load strategy history");
  const data = await res.json();
  return data.items;
}

export async function getInvestmentPlan(params: {
  symbol?: string;
  assetClass?: AssetClass;
  timeframe: Timeframe;
  theme: PlanTheme;
  prompt?: string;
}): Promise<InvestmentPlan> {
  const query = new URLSearchParams({
    timeframe: params.timeframe,
    theme: params.theme,
    ...(params.symbol ? { symbol: params.symbol } : {}),
    ...(params.assetClass ? { assetClass: params.assetClass } : {}),
    ...(params.prompt ? { prompt: params.prompt } : {}),
  });

  const res = await fetch(`${API_BASE}/plan?${query.toString()}`);
  if (!res.ok) throw new Error("Unable to load investment plan");
  return res.json();
}

export async function getPlanHistory(params?: {
  symbol?: string;
  theme?: PlanTheme;
  limit?: number;
}): Promise<PlanHistoryEntry[]> {
  const query = new URLSearchParams({
    ...(params?.symbol ? { symbol: params.symbol } : {}),
    ...(params?.theme ? { theme: params.theme } : {}),
    ...(params?.limit ? { limit: String(params.limit) } : {}),
  });

  const res = await fetch(`${API_BASE}/plan/history?${query.toString()}`);
  if (!res.ok) throw new Error("Unable to load plan history");
  const data = await res.json();
  return data.items;
}

export async function createAlert(payload: {
  symbol: string;
  assetClass: AssetClass;
  direction: "above" | "below";
  targetPrice: number;
}): Promise<AlertRule> {
  const res = await fetch(`${API_BASE}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Unable to create alert");
  return res.json();
}

export async function deleteAlert(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Unable to delete alert");
}

export function openQuoteStream(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
  onQuote: (quote: LiveQuote) => void,
  onAlert: (alert: TriggeredAlert) => void,
  onStrategy?: (strategy: StrategyStreamEvent) => void,
): () => void {
  const query = new URLSearchParams({ symbol, assetClass, timeframe });
  const es = new EventSource(`${API_BASE}/stream?${query.toString()}`);

  es.addEventListener("quote", (event) => {
    const quote = JSON.parse((event as MessageEvent).data) as LiveQuote;
    onQuote(quote);
  });

  es.addEventListener("alert", (event) => {
    const alert = JSON.parse((event as MessageEvent).data) as TriggeredAlert;
    onAlert(alert);
  });

  es.addEventListener("strategy", (event) => {
    if (!onStrategy) return;
    const strategy = JSON.parse(
      (event as MessageEvent).data,
    ) as StrategyStreamEvent;
    onStrategy(strategy);
  });

  return () => es.close();
}
