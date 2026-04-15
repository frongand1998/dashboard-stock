import { analyzeAsset } from "./analysisService.js";
import type {
  AssetClass,
  InvestmentPlan,
  InvestmentPlanStep,
  PlanTheme,
  Timeframe,
} from "../types.js";

interface BuildPlanInput {
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  theme: PlanTheme;
  customPrompt?: string;
}

function pickDefaultSymbol(theme: PlanTheme): {
  symbol: string;
  assetClass: AssetClass;
} {
  if (theme === "war") return { symbol: "LMT", assetClass: "stock" };
  if (theme === "ai") return { symbol: "NVDA", assetClass: "stock" };
  return { symbol: "AAPL", assetClass: "stock" };
}

function normalizeEntries(entries: InvestmentPlanStep[]): InvestmentPlanStep[] {
  const total = entries.reduce((sum, item) => sum + item.allocationPercent, 0);
  if (total <= 0) return entries;
  const scaled = entries.map((item) => ({
    ...item,
    allocationPercent: Number(
      ((item.allocationPercent / total) * 100).toFixed(1),
    ),
  }));

  // Fix rounding drift on the final row to keep total at 100.
  const drift = Number(
    (100 - scaled.reduce((s, e) => s + e.allocationPercent, 0)).toFixed(1),
  );
  if (scaled.length > 0 && Math.abs(drift) > 0) {
    scaled[scaled.length - 1].allocationPercent = Number(
      (scaled[scaled.length - 1].allocationPercent + drift).toFixed(1),
    );
  }
  return scaled;
}

function buildThemeEntries(input: {
  symbol: string;
  theme: PlanTheme;
  confidence: number;
  riskGuardrail: boolean;
}): InvestmentPlanStep[] {
  const { symbol, theme, confidence, riskGuardrail } = input;
  const base = confidence >= 70 ? 55 : confidence >= 55 ? 40 : 25;
  const core = riskGuardrail ? Math.max(15, base - 15) : base;

  if (theme === "war") {
    return normalizeEntries([
      {
        label: `${symbol} Tactical Core`,
        allocationPercent: core,
        rationale:
          "Primary defense/cash-flow exposure during geopolitical stress.",
      },
      {
        label: "Energy / Commodities Sleeve",
        allocationPercent: 25,
        rationale:
          "Adds inflation and supply-shock hedge during conflict spikes.",
      },
      {
        label: "Cash Reserve",
        allocationPercent: 100 - core - 25,
        rationale: "Dry powder for volatility events and quick rebalancing.",
      },
    ]);
  }

  if (theme === "ai") {
    return normalizeEntries([
      {
        label: `${symbol} AI Core`,
        allocationPercent: core,
        rationale:
          "Primary AI leadership position for earnings momentum capture.",
      },
      {
        label: "AI Platform Diversifier",
        allocationPercent: 30,
        rationale: "Second AI name to reduce single-name execution risk.",
      },
      {
        label: "Cash / Short-duration",
        allocationPercent: 100 - core - 30,
        rationale: "Buffers pullbacks after fast AI sentiment swings.",
      },
    ]);
  }

  return normalizeEntries([
    {
      label: `${symbol} Core Position`,
      allocationPercent: core,
      rationale:
        "Size core exposure from signal strength and current volatility.",
    },
    {
      label: "Satellite Hedge",
      allocationPercent: 20,
      rationale: "Counter-trend or sector hedge to reduce drawdown shocks.",
    },
    {
      label: "Cash Reserve",
      allocationPercent: 100 - core - 20,
      rationale: "Reserve for staged entries when setup improves.",
    },
  ]);
}

export async function buildInvestmentPlan(
  input: BuildPlanInput,
): Promise<InvestmentPlan> {
  const fallback = pickDefaultSymbol(input.theme);
  const symbol = input.symbol?.trim().toUpperCase() || fallback.symbol;
  const assetClass = input.assetClass ?? fallback.assetClass;
  const timeframe = input.timeframe;

  const analysis = await analyzeAsset(symbol, assetClass, timeframe);
  const confidence = analysis.decision.confidence;
  const riskGuardrail = analysis.decision.riskGuardrailTriggered;

  const actionNow =
    analysis.decision.tradeSignal === "BUY_NOW"
      ? `Start a staged buy in ${analysis.symbol} now.`
      : analysis.decision.tradeSignal === "SELL_NOW"
        ? `Trim or de-risk ${analysis.symbol} now.`
        : analysis.decision.tradeSignal === "HOLD"
          ? `Hold current exposure in ${analysis.symbol}; avoid chasing.`
          : analysis.decision.tradeSignal === "AVOID"
            ? `Avoid new entries in ${analysis.symbol} now.`
            : `Wait for better entry or lower volatility in ${analysis.symbol}.`;

  const entries = buildThemeEntries({
    symbol: analysis.symbol,
    theme: input.theme,
    confidence,
    riskGuardrail,
  });

  const themeLabel =
    input.theme === "war"
      ? "War-Resilient"
      : input.theme === "ai"
        ? "AI Momentum"
        : input.theme === "custom"
          ? "Custom"
          : "Current";

  const summary =
    input.theme === "custom" && input.customPrompt
      ? `Custom focus: ${input.customPrompt}. Signal is ${analysis.decision.tradeSignal} with confidence ${confidence.toFixed(1)}.`
      : `${themeLabel} plan for ${analysis.symbol} based on live signal ${analysis.decision.tradeSignal} and confidence ${confidence.toFixed(1)}.`;

  return {
    symbol: analysis.symbol,
    assetClass: analysis.assetClass,
    timeframe: analysis.timeframe,
    theme: input.theme,
    planName: `${themeLabel} Plan - ${analysis.symbol}`,
    generatedAt: new Date().toISOString(),
    tradeSignal: analysis.decision.tradeSignal,
    confidence,
    actionNow,
    summary,
    entries,
    executionChecklist: [
      `Enter in 2-3 tranches near buy zone ${analysis.decision.buyRange.low} - ${analysis.decision.buyRange.high}.`,
      `Set first alert near invalidation around ${analysis.decision.buyRange.low}.`,
      "Avoid full-size entry during a single headline spike.",
      "Re-evaluate after next strategy update cycle or major news release.",
    ],
    riskRules: [
      riskGuardrail
        ? "Volatility guardrail active: cap fresh allocation to half-size until volatility cools."
        : "Normal volatility: use standard position size.",
      `Take-profit planning near ${analysis.decision.sellRange.low} - ${analysis.decision.sellRange.high}.`,
      "Maximum single-position risk budget: 1-2% of total portfolio.",
    ],
    reviewCadence:
      input.theme === "war"
        ? "every 12h"
        : input.theme === "ai"
          ? "daily"
          : "every 24h",
  };
}
