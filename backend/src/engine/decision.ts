import type {
  DecisionOutput,
  IndicatorSet,
  Quote,
  TradeSignal,
} from "../types.js";

export function buildDecision(
  score: number,
  quote: Quote,
  indicators: IndicatorSet,
  reasonsPool: string[],
  uncertaintyNotes: string[],
  contradictionWarning?: string,
): DecisionOutput {
  const atr = Math.max(indicators.atr14, quote.price * 0.01);
  const buyRange = {
    low: Number(Math.max(0, indicators.support - atr * 0.5).toFixed(2)),
    high: Number((indicators.support + atr * 0.8).toFixed(2)),
  };
  const sellRange = {
    low: Number((indicators.resistance - atr * 0.8).toFixed(2)),
    high: Number((indicators.resistance + atr * 0.5).toFixed(2)),
  };

  let action: "BUY" | "WAIT" | "AVOID" = "WAIT";
  if (score >= 70) action = "BUY";
  if (score < 45) action = "AVOID";

  // Derive real-time trade signal from action, price position, and RSI
  let tradeSignal: TradeSignal;
  const atResistance = quote.price >= sellRange.low;
  const atSupport = quote.price <= buyRange.high;
  const volatilityGuardrail =
    quote.volatility >= (quote.assetClass === "crypto" ? 0.09 : 0.05);

  if (atResistance) {
    // Price has reached the sell zone — take-profit signal regardless of score
    tradeSignal = "SELL_NOW";
  } else if (
    action === "BUY" &&
    atSupport &&
    indicators.rsi14 < 70 &&
    !volatilityGuardrail
  ) {
    // Strong score + price still in entry zone + not overbought
    tradeSignal = "BUY_NOW";
  } else if (action === "BUY" && volatilityGuardrail) {
    // Positive setup exists, but guardrail blocks immediate entry.
    tradeSignal = "WAIT";
  } else if (action === "BUY") {
    // Strong score but price already above entry zone — hold existing position
    tradeSignal = "HOLD";
  } else if (action === "AVOID") {
    tradeSignal = "AVOID";
  } else {
    tradeSignal = "WAIT";
  }

  const holdUntilConditions = [
    `Price reaches ${sellRange.low} or breaks below ${buyRange.low}.`,
    `RSI crosses ${action === "BUY" ? "70" : "55"} for reassessment.`,
    `Review again in ${action === "BUY" ? "7" : "3"} days.`,
  ];

  if (volatilityGuardrail) {
    holdUntilConditions.unshift(
      "Volatility guardrail is active; wait for calmer market conditions before new entries.",
    );
  }

  return {
    action,
    tradeSignal,
    riskGuardrailTriggered: volatilityGuardrail,
    buyRange,
    sellRange,
    holdUntilConditions,
    confidence: Number(score.toFixed(1)),
    reasonsTop3: reasonsPool.slice(0, 3),
    uncertaintyNotes,
    contradictionWarning,
  };
}
