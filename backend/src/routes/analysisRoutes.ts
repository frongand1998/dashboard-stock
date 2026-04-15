import { Router } from "express";
import { z } from "zod";
import type { Quote } from "../types.js";
import {
  analyzeAsset,
  buildStrategySnapshot,
  seedWatchlist,
} from "../services/analysisService.js";
import { createProvider } from "../adapters/providerRegistry.js";
import {
  createAlert,
  deleteAlert,
  evaluateAlerts,
  listAlerts,
  listTriggeredAlerts,
} from "../services/alertsStore.js";
import {
  getStrategyHistory,
  isMarketOn,
  pushStrategyUpdate,
} from "../services/strategyStore.js";
import { buildInvestmentPlan } from "../services/planService.js";
import {
  listPlanHistory,
  recordPlanHistory,
} from "../services/planHistoryStore.js";

const querySchema = z.object({
  symbol: z.string().trim().min(1),
  assetClass: z.enum(["stock", "crypto"]).default("stock"),
  timeframe: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
});

const planQuerySchema = z.object({
  symbol: z.string().trim().optional(),
  assetClass: z.enum(["stock", "crypto"]).default("stock"),
  timeframe: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
  theme: z.enum(["now", "war", "ai", "custom"]).default("now"),
  prompt: z.string().trim().max(120).optional(),
});

const planHistoryQuerySchema = z.object({
  symbol: z.string().trim().optional(),
  theme: z.enum(["now", "war", "ai", "custom"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const analysisRoutes = Router();

analysisRoutes.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

analysisRoutes.get("/watchlist", (_req, res) => {
  res.json({ items: seedWatchlist });
});

analysisRoutes.get("/analyze", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { symbol, assetClass, timeframe } = parsed.data;
    const result = await analyzeAsset(
      symbol.toUpperCase(),
      assetClass,
      timeframe,
    );

    if (isMarketOn(result.quote)) {
      pushStrategyUpdate({
        symbol: result.symbol,
        assetClass: result.assetClass,
        timeframe: result.timeframe,
        quotePrice: result.quote.price,
        timestamp: result.timestamp,
        snapshot: {
          indicators: result.indicators,
          technicalScore: result.technicalScore,
          newsScore: result.newsScore,
          riskScore: result.riskScore,
          finalScore: result.finalScore,
          newsSummary: result.newsSummary,
          decision: result.decision,
        },
      });
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(500).json({ error: message });
  }
});

analysisRoutes.get("/plan", async (req, res) => {
  const parsed = planQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await buildInvestmentPlan({
      symbol: parsed.data.symbol ?? "",
      assetClass: parsed.data.assetClass,
      timeframe: parsed.data.timeframe,
      theme: parsed.data.theme,
      customPrompt: parsed.data.prompt,
    });
    recordPlanHistory(result);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(500).json({ error: message });
  }
});

analysisRoutes.get("/plan/history", (req, res) => {
  const parsed = planHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const items = listPlanHistory({
    symbol: parsed.data.symbol,
    theme: parsed.data.theme,
    limit: parsed.data.limit,
  });

  return res.json({ items });
});

const alertSchema = z.object({
  symbol: z.string().trim().min(1),
  assetClass: z.enum(["stock", "crypto"]),
  direction: z.enum(["above", "below"]),
  targetPrice: z.number().positive(),
});

analysisRoutes.get("/alerts", (_req, res) => {
  res.json({ rules: listAlerts(), triggered: listTriggeredAlerts() });
});

const strategyHistoryQuerySchema = z.object({
  symbol: z.string().trim().min(1),
  assetClass: z.enum(["stock", "crypto"]),
  timeframe: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

analysisRoutes.get("/strategy/history", (req, res) => {
  const parsed = strategyHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { symbol, assetClass, timeframe, limit } = parsed.data;
  const items = getStrategyHistory({
    symbol: symbol.toUpperCase(),
    assetClass,
    timeframe,
    limit,
  });

  return res.json({ items });
});

analysisRoutes.post("/alerts", (req, res) => {
  const parsed = alertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const rule = createAlert({
    ...parsed.data,
    symbol: parsed.data.symbol.toUpperCase(),
  });

  return res.status(201).json(rule);
});

analysisRoutes.delete("/alerts/:id", (req, res) => {
  const removed = deleteAlert(req.params.id);
  if (!removed) return res.status(404).json({ error: "Alert not found" });
  return res.status(204).send();
});

const streamQuerySchema = z.object({
  symbol: z.string().trim().min(1),
  assetClass: z.enum(["stock", "crypto"]),
  timeframe: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
});

analysisRoutes.get("/stream", async (req, res) => {
  const parsed = streamQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { symbol, assetClass, timeframe } = parsed.data;
  const symbolUpper = symbol.toUpperCase();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(
    `event: connected\ndata: ${JSON.stringify({ symbol: symbolUpper, assetClass })}\n\n`,
  );

  let stopStreaming: (() => void) | null = null;
  let strategyTimer: NodeJS.Timeout | null = null;
  let latestQuote: Quote | null = null;
  let strategyInFlight = false;
  let lastStrategyAt = 0;

  try {
    const provider = createProvider();

    const emitStrategy = async () => {
      if (!latestQuote || strategyInFlight) return;

      strategyInFlight = true;
      try {
        const [candles, news] = await Promise.all([
          provider.getCandles(symbolUpper, timeframe, assetClass),
          provider.getNews(symbolUpper, assetClass),
        ]);

        const snapshot = buildStrategySnapshot(latestQuote, candles, news);

        const shouldPersistHistory = isMarketOn(latestQuote);
        const strategyTimestamp = new Date().toISOString();
        const historyResult = shouldPersistHistory
          ? pushStrategyUpdate({
              symbol: symbolUpper,
              assetClass,
              timeframe,
              quotePrice: latestQuote.price,
              timestamp: strategyTimestamp,
              snapshot,
            })
          : null;

        res.write(
          `event: strategy\ndata: ${JSON.stringify({
            symbol: symbolUpper,
            assetClass,
            timeframe,
            indicators: snapshot.indicators,
            technicalScore: snapshot.technicalScore,
            newsScore: snapshot.newsScore,
            riskScore: snapshot.riskScore,
            finalScore: snapshot.finalScore,
            newsSummary: snapshot.newsSummary,
            decision: snapshot.decision,
            timestamp: strategyTimestamp,
          })}\n\n`,
        );

        if (historyResult?.signalAlert) {
          res.write(`event: alert\ndata: ${JSON.stringify(historyResult.signalAlert)}\n\n`);
        }
        lastStrategyAt = Date.now();
      } catch {
        // Ignore intermittent news/candle pull errors to keep quote stream alive.
      } finally {
        strategyInFlight = false;
      }
    };

    stopStreaming = await provider.streamQuote(
      symbolUpper,
      assetClass,
      (quote) => {
        latestQuote = quote;
        res.write(`event: quote\ndata: ${JSON.stringify(quote)}\n\n`);

        if (Date.now() - lastStrategyAt > 15_000) {
          void emitStrategy();
        }

        const triggered = evaluateAlerts(
          quote.symbol,
          quote.assetClass,
          quote.price,
        );
        for (const event of triggered) {
          res.write(`event: alert\ndata: ${JSON.stringify(event)}\n\n`);
        }
      },
    );

    strategyTimer = setInterval(() => {
      void emitStrategy();
    }, 30_000);
  } catch {
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: "Unable to start stream" })}\n\n`,
    );
    res.end();
    return;
  }

  req.on("close", () => {
    if (strategyTimer) clearInterval(strategyTimer);
    if (stopStreaming) stopStreaming();
    res.end();
  });
});
