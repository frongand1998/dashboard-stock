import axios from "axios";
import { MockProvider } from "./mockProvider.js";
import type {
  AssetClass,
  Candle,
  DataProvider,
  Fundamentals,
  NewsItem,
  Quote,
  Timeframe,
} from "../types.js";

const mock = new MockProvider();

const yahooIntervalMap: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "60m",
  "4h": "1h",
  "1d": "1d",
};

const yahooRangeMap: Record<Timeframe, string> = {
  "15m": "5d",
  "1h": "1mo",
  "4h": "3mo",
  "1d": "1y",
};

const stockIntervalMap: Record<Timeframe, string> = {
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

const cryptoIntervalMap: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

async function safeRequest<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function isFiniteQuote(quote: Quote | null): quote is Quote {
  if (!quote) return false;
  return (
    Number.isFinite(quote.price) &&
    Number.isFinite(quote.changePercent24h) &&
    Number.isFinite(quote.volume24h) &&
    Number.isFinite(quote.volatility)
  );
}

function inferSentimentFromHeadline(title: string): number {
  const lowered = title.toLowerCase();
  const positiveWords = [
    "surge",
    "gain",
    "beat",
    "upgrade",
    "bullish",
    "rally",
    "growth",
    "partnership",
    "approval",
  ];
  const negativeWords = [
    "drop",
    "fall",
    "miss",
    "downgrade",
    "bearish",
    "hack",
    "lawsuit",
    "ban",
    "risk",
  ];

  const positiveHits = positiveWords.filter((word) =>
    lowered.includes(word),
  ).length;
  const negativeHits = negativeWords.filter((word) =>
    lowered.includes(word),
  ).length;
  if (positiveHits === negativeHits) return 0;
  return Math.max(-1, Math.min(1, (positiveHits - negativeHits) * 0.25));
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchGoogleNewsRss(
  query: string,
  tags: string[],
): Promise<NewsItem[] | null> {
  return safeRequest(async () => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const { data } = await axios.get<string>(url, {
      responseType: "text",
      timeout: 7000,
    });

    const items = Array.from(data.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(
      0,
      8,
    );
    return items.map((match, idx) => {
      const block = match[1];
      const title = decodeHtml(
        block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? `News ${idx + 1}`,
      );
      const link = decodeHtml(
        block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "",
      );
      const publishedAt =
        block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ??
        new Date().toUTCString();
      const source = decodeHtml(
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "google-news",
      );

      return {
        id: `${query}-${idx}`,
        title,
        source,
        url: link,
        publishedAt: new Date(publishedAt).toISOString(),
        sentiment: inferSentimentFromHeadline(title),
        relevance: 0.72,
        tags,
      } satisfies NewsItem;
    });
  });
}

async function fetchYahooChart(
  symbol: string,
  timeframe: Timeframe,
): Promise<{
  quote: Quote;
  candles: Candle[];
} | null> {
  return safeRequest(async () => {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      {
        params: {
          interval: yahooIntervalMap[timeframe],
          range: yahooRangeMap[timeframe],
          includePrePost: false,
        },
        timeout: 7000,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
    );

    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const timestamps = result?.timestamp ?? [];
    const quoteSeries = result?.indicators?.quote?.[0];
    if (!meta || !quoteSeries || timestamps.length === 0) {
      throw new Error("Invalid Yahoo chart response");
    }

    const candles: Candle[] = timestamps
      .map((time: number, index: number) => ({
        time,
        open: Number(quoteSeries.open?.[index]),
        high: Number(quoteSeries.high?.[index]),
        low: Number(quoteSeries.low?.[index]),
        close: Number(quoteSeries.close?.[index]),
        volume: Number(quoteSeries.volume?.[index] ?? 0),
      }))
      .filter(
        (candle: Candle) =>
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close),
      );

    if (candles.length === 0) {
      throw new Error("No usable Yahoo candles");
    }

    const previousClose = Number(
      meta.regularMarketPreviousClose ??
        meta.chartPreviousClose ??
        candles.at(-2)?.close ??
        candles[0].close,
    );
    const price = Number(
      meta.regularMarketPrice ?? candles[candles.length - 1].close,
    );
    const changePercent24h =
      previousClose === 0 ? 0 : ((price - previousClose) / previousClose) * 100;
    const volumes = candles.map((candle) => candle.volume);

    return {
      quote: {
        symbol,
        assetClass: "stock",
        price,
        changePercent24h: Number(changePercent24h.toFixed(2)),
        volume24h: volumes[volumes.length - 1] ?? 0,
        volatility: Math.abs(changePercent24h) / 100,
        marketStatus: meta.marketState === "REGULAR" ? "open" : "closed",
        delayMinutes: 15,
        source: "yahoo-finance",
        timestamp: new Date().toISOString(),
      },
      candles,
    };
  });
}

async function fetchYahooDailyQuote(symbol: string): Promise<Quote | null> {
  return safeRequest(async () => {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      {
        params: {
          interval: "1d",
          range: "5d",
          includePrePost: false,
        },
        timeout: 7000,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
    );

    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const closeSeries = (result?.indicators?.quote?.[0]?.close ?? [])
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value));

    if (!meta || closeSeries.length < 2) {
      throw new Error("Invalid Yahoo daily quote response");
    }

    const price = Number(
      meta.regularMarketPrice ?? closeSeries[closeSeries.length - 1],
    );
    const previousClose = Number(closeSeries[closeSeries.length - 2]);
    const dailyPercent =
      previousClose === 0 ? 0 : ((price - previousClose) / previousClose) * 100;

    if (!Number.isFinite(price) || !Number.isFinite(dailyPercent)) {
      throw new Error("Yahoo quote missing market values");
    }

    const delayMinutes = Number(meta.dataGranularity === "1d" ? 15 : 0);
    const marketStatus = meta.marketState === "REGULAR" ? "open" : "closed";

    return {
      symbol,
      assetClass: "stock",
      price: Number(price.toFixed(4)),
      changePercent24h: Number(dailyPercent.toFixed(2)),
      volume24h: Number(meta.regularMarketVolume ?? 0),
      volatility: Math.abs(dailyPercent) / 100,
      marketStatus,
      delayMinutes: Number.isFinite(delayMinutes) ? delayMinutes : 15,
      source: "yahoo-finance",
      timestamp: new Date().toISOString(),
    };
  });
}

export class FreeTierProvider implements DataProvider {
  name = "free-tier-provider";

  async getQuote(symbol: string, assetClass: AssetClass): Promise<Quote> {
    if (assetClass === "crypto") {
      const quote = await safeRequest(async () => {
        const pair = symbol.toUpperCase();
        const url = `${process.env.BINANCE_REST_URL ?? "https://api.binance.com"}/api/v3/ticker/24hr`;
        const { data } = await axios.get(url, {
          params: { symbol: pair },
          timeout: 7000,
        });
        return {
          symbol,
          assetClass,
          price: Number(data.lastPrice),
          changePercent24h: Number(data.priceChangePercent),
          volume24h: Number(data.quoteVolume),
          volatility: Math.abs(Number(data.priceChangePercent)) / 100,
          marketStatus: "always_open" as const,
          delayMinutes: 0,
          source: "binance",
          timestamp: new Date().toISOString(),
        };
      });

      if (quote) return quote;
      return mock.getQuote(symbol, assetClass);
    }

    const key = process.env.TWELVE_DATA_API_KEY;
    if (!key) {
      const yahooQuote = await fetchYahooDailyQuote(symbol);
      if (yahooQuote) return yahooQuote;
      const yahooChart = await fetchYahooChart(symbol, "1d");
      if (yahooChart) return yahooChart.quote;
      const fallback = await mock.getQuote(symbol, assetClass);
      return { ...fallback, delayMinutes: 15, source: "mock-delayed" };
    }

    const quote = await safeRequest(async () => {
      const { data } = await axios.get("https://api.twelvedata.com/quote", {
        params: { symbol, apikey: key },
        timeout: 7000,
      });

      const price = Number(data?.close);
      const changePercent24h = Number(data?.percent_change);
      const volume24h = Number(data?.volume ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(changePercent24h)) {
        throw new Error("TwelveData quote missing numeric values");
      }

      return {
        symbol,
        assetClass,
        price,
        changePercent24h,
        volume24h,
        volatility: Math.abs(changePercent24h) / 100,
        marketStatus: "open" as const,
        delayMinutes: 15,
        source: "twelve-data",
        timestamp: new Date().toISOString(),
      };
    });

    if (isFiniteQuote(quote)) return quote;
    const yahooQuote = await fetchYahooDailyQuote(symbol);
    if (isFiniteQuote(yahooQuote)) return yahooQuote;
    const yahooChart = await fetchYahooChart(symbol, "1d");
    const yahooChartQuote = yahooChart?.quote ?? null;
    if (isFiniteQuote(yahooChartQuote)) return yahooChartQuote;
    const fallback = await mock.getQuote(symbol, assetClass);
    return { ...fallback, delayMinutes: 15, source: "mock-delayed" };
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    assetClass: AssetClass,
  ): Promise<Candle[]> {
    if (assetClass === "crypto") {
      const candles = await safeRequest(async () => {
        const url = `${process.env.BINANCE_REST_URL ?? "https://api.binance.com"}/api/v3/klines`;
        const { data } = await axios.get(url, {
          params: {
            symbol: symbol.toUpperCase(),
            interval: cryptoIntervalMap[timeframe],
            limit: 200,
          },
          timeout: 7000,
        });

        return data.map((k: string[]) => ({
          time: Math.floor(Number(k[0]) / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
        })) as Candle[];
      });

      if (candles && candles.length > 10) return candles;
      return mock.getCandles(symbol, timeframe, assetClass);
    }

    const key = process.env.TWELVE_DATA_API_KEY;
    if (!key) {
      const yahoo = await fetchYahooChart(symbol, timeframe);
      if (yahoo && yahoo.candles.length > 10) return yahoo.candles;
      return mock.getCandles(symbol, timeframe, assetClass);
    }

    const candles = await safeRequest(async () => {
      const { data } = await axios.get(
        "https://api.twelvedata.com/time_series",
        {
          params: {
            symbol,
            interval: stockIntervalMap[timeframe],
            outputsize: 200,
            apikey: key,
          },
          timeout: 7000,
        },
      );

      return (data.values ?? [])
        .map((v: Record<string, string>) => ({
          time: Math.floor(new Date(v.datetime).getTime() / 1000),
          open: Number(v.open),
          high: Number(v.high),
          low: Number(v.low),
          close: Number(v.close),
          volume: Number(v.volume ?? 0),
        }))
        .reverse();
    });

    if (candles && candles.length > 10) return candles;
    const yahoo = await fetchYahooChart(symbol, timeframe);
    if (yahoo && yahoo.candles.length > 10) return yahoo.candles;
    return mock.getCandles(symbol, timeframe, assetClass);
  }

  async streamQuote(
    symbol: string,
    assetClass: AssetClass,
    onTick: (quote: Quote) => void,
  ): Promise<() => void> {
    const timer = setInterval(async () => {
      const q = await this.getQuote(symbol, assetClass);
      onTick(q);
    }, 6000);

    return () => clearInterval(timer);
  }

  async getNews(symbol: string, assetClass: AssetClass): Promise<NewsItem[]> {
    if (assetClass === "crypto") {
      const key = process.env.CRYPTOPANIC_API_KEY;
      if (!key) {
        const rssNews = await fetchGoogleNewsRss(
          `${symbol.replace("USDT", "")} crypto`,
          ["crypto", "rss"],
        );
        if (rssNews && rssNews.length > 0) return rssNews;
        return mock.getNews(symbol, assetClass);
      }

      const news = await safeRequest(async () => {
        const { data } = await axios.get(
          "https://cryptopanic.com/api/developer/v2/posts/",
          {
            params: {
              auth_token: key,
              currencies: symbol.replace("USDT", ""),
              kind: "news",
            },
            timeout: 7000,
          },
        );

        return (data.results ?? [])
          .slice(0, 8)
          .map((item: any, idx: number) => ({
            id: item.id?.toString() ?? `${symbol}-${idx}`,
            title: item.title,
            source: item.source?.title ?? "cryptopanic",
            url: item.url ?? "",
            publishedAt: item.published_at,
            sentiment: 0,
            relevance: 0.7,
            tags: ["news"],
          })) as NewsItem[];
      });

      if (news && news.length > 0) return news;
      const rssNews = await fetchGoogleNewsRss(
        `${symbol.replace("USDT", "")} crypto`,
        ["crypto", "rss"],
      );
      if (rssNews && rssNews.length > 0) return rssNews;
      return mock.getNews(symbol, assetClass);
    }

    const rssNews = await fetchGoogleNewsRss(`${symbol} stock`, [
      "stock",
      "rss",
    ]);
    if (rssNews && rssNews.length > 0) return rssNews;
    return mock.getNews(symbol, assetClass);
  }

  async getFundamentalsOrOnChain(
    symbol: string,
    assetClass: AssetClass,
  ): Promise<Fundamentals> {
    if (assetClass === "crypto") {
      const details = await safeRequest(async () => {
        const coinId = symbol.toLowerCase().replace("usdt", "");
        const { data } = await axios.get(
          `${process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3"}/coins/${coinId}`,
          {
            timeout: 7000,
            params: {
              localization: false,
              tickers: false,
              market_data: true,
              community_data: false,
              developer_data: false,
              sparkline: false,
            },
          },
        );

        return {
          marketCap: Number(data?.market_data?.market_cap?.usd ?? 0),
          circulatingSupply: Number(data?.market_data?.circulating_supply ?? 0),
        };
      });

      if (details) return details;
      return mock.getFundamentalsOrOnChain(symbol, assetClass);
    }

    return mock.getFundamentalsOrOnChain(symbol, assetClass);
  }
}
