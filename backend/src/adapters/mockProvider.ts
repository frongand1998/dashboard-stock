import type {
  AssetClass,
  Candle,
  DataProvider,
  Fundamentals,
  NewsItem,
  Quote,
  Timeframe,
} from "../types.js";

const timeframeToMinutes: Record<Timeframe, number> = {
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
};

function hash(text: string): number {
  return text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildBasePrice(symbol: string, assetClass: AssetClass): number {
  const seed = hash(symbol);
  if (assetClass === "crypto") {
    return 30 + seededRandom(seed) * 70000;
  }
  return 15 + seededRandom(seed) * 350;
}

function buildCandles(basePrice: number, timeframe: Timeframe): Candle[] {
  const candles: Candle[] = [];
  const step = timeframeToMinutes[timeframe] * 60;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 150; i >= 0; i -= 1) {
    const t = now - i * step;
    const drift = Math.sin(i / 9) * 0.008;
    const noise = (Math.random() - 0.5) * 0.01;
    const price = basePrice * (1 + drift + noise);
    const open = price * (1 + (Math.random() - 0.5) * 0.002);
    const close = price * (1 + (Math.random() - 0.5) * 0.002);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.round(2000 + Math.random() * 20000);
    candles.push({ time: t, open, high, low, close, volume });
  }

  return candles;
}

function buildNews(symbol: string): NewsItem[] {
  const now = Date.now();
  const templates = [
    {
      title: `${symbol} sentiment improves after strong ecosystem activity`,
      sentiment: 0.55,
      relevance: 0.82,
      tags: ["partnership", "macro"],
    },
    {
      title: `${symbol} faces regulatory headline, traders watch volatility`,
      sentiment: -0.35,
      relevance: 0.78,
      tags: ["regulation", "macro"],
    },
    {
      title: `Analysts review ${symbol} trend strength and risk outlook`,
      sentiment: 0.05,
      relevance: 0.66,
      tags: ["market-structure"],
    },
  ];

  return templates.map((item, idx) => ({
    id: `${symbol}-${idx}`,
    title: item.title,
    source: "mock-news",
    url: "https://example.com",
    publishedAt: new Date(now - idx * 1000 * 60 * 90).toISOString(),
    sentiment: item.sentiment,
    relevance: item.relevance,
    tags: item.tags,
  }));
}

export class MockProvider implements DataProvider {
  name = "mock-provider";

  async getQuote(symbol: string, assetClass: AssetClass): Promise<Quote> {
    const base = buildBasePrice(symbol, assetClass);
    const price = Number(
      (base * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
    );
    return {
      symbol,
      assetClass,
      price,
      changePercent24h: Number(((Math.random() - 0.5) * 8).toFixed(2)),
      volume24h: Math.round(100000 + Math.random() * 9000000),
      volatility: Number((0.02 + Math.random() * 0.08).toFixed(4)),
      marketStatus: assetClass === "crypto" ? "always_open" : "open",
      delayMinutes: 0,
      source: this.name,
      timestamp: new Date().toISOString(),
    };
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    assetClass: AssetClass,
  ): Promise<Candle[]> {
    return buildCandles(buildBasePrice(symbol, assetClass), timeframe);
  }

  async streamQuote(
    symbol: string,
    assetClass: AssetClass,
    onTick: (quote: Quote) => void,
  ): Promise<() => void> {
    const timer = setInterval(async () => {
      const q = await this.getQuote(symbol, assetClass);
      onTick(q);
    }, 5000);

    return () => clearInterval(timer);
  }

  async getNews(symbol: string, _assetClass: AssetClass): Promise<NewsItem[]> {
    return buildNews(symbol);
  }

  async getFundamentalsOrOnChain(
    _symbol: string,
    assetClass: AssetClass,
  ): Promise<Fundamentals> {
    if (assetClass === "crypto") {
      return {
        marketCap: Math.round(5_000_000_000 + Math.random() * 250_000_000_000),
        circulatingSupply: Math.round(1_000_000 + Math.random() * 50_000_000),
      };
    }

    return {
      marketCap: Math.round(1_000_000_000 + Math.random() * 800_000_000_000),
      peRatio: Number((5 + Math.random() * 35).toFixed(2)),
    };
  }
}
