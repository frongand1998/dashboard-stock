import {
  ColorType,
  createChart,
  type AreaData,
  type LineData,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { AnalysisResponse } from "../types/analysis";

interface Props {
  analysis: AnalysisResponse;
}

type ProjectionPoint = {
  time: number;
  value: number;
  upper: number;
  lower: number;
};

const FORECAST_POINTS = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createProjection(analysis: AnalysisResponse): ProjectionPoint[] {
  const candles = analysis.candles;
  if (candles.length < 3) return [];

  const closes = candles.map((c) => c.close);
  const lastTime = candles[candles.length - 1]?.time ?? 0;
  const basePrice = closes[closes.length - 1] ?? 0;
  const interval = Math.max(
    60,
    candles[candles.length - 1].time - candles[candles.length - 2].time,
  );

  const shortWindow = closes.slice(-6);
  const driftPerBar =
    shortWindow.length > 1
      ? (shortWindow[shortWindow.length - 1] - shortWindow[0]) /
        (shortWindow.length - 1)
      : 0;

  const confidenceBias = clamp((analysis.decision.confidence - 0.5) * 2, -1, 1);
  const directionalBias =
    analysis.decision.tradeSignal === "BUY_NOW"
      ? 1
      : analysis.decision.tradeSignal === "SELL_NOW"
        ? -1
        : 0;

  const trendBoost = 1 + confidenceBias * 0.25 + directionalBias * 0.18;
  const projectedDrift = driftPerBar * trendBoost;

  const volatility = Math.max(analysis.indicators.atr14, basePrice * 0.0035);

  const points: ProjectionPoint[] = [];
  let rollingPrice = basePrice;

  for (let i = 1; i <= FORECAST_POINTS; i += 1) {
    const easing = 1 - (i - 1) / (FORECAST_POINTS * 1.25);
    rollingPrice += projectedDrift * easing;

    const wave =
      Math.sin((i / FORECAST_POINTS) * Math.PI * 2.2) * volatility * 0.16;
    const value = Math.max(0.01, rollingPrice + wave);

    const spread =
      volatility * (0.22 + i * 0.05) * (1.15 - confidenceBias * 0.2);

    points.push({
      time: lastTime + interval * i,
      value,
      upper: value + spread,
      lower: Math.max(0.01, value - spread),
    });
  }

  return points;
}

export function StockPredictionGraph({ analysis }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const projection = useMemo(() => createProjection(analysis), [analysis]);

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#071826" },
        textColor: "#cde9ff",
      },
      grid: {
        horzLines: { color: "rgba(120, 171, 208, 0.16)" },
        vertLines: { color: "rgba(120, 171, 208, 0.12)" },
      },
      width: ref.current.clientWidth,
      height: 280,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: "rgba(125, 211, 252, 0.35)", width: 1 },
        horzLine: { color: "rgba(125, 211, 252, 0.35)", width: 1 },
      },
    });

    const historySeries = chart.addAreaSeries({
      lineColor: "#7dd3fc",
      topColor: "rgba(125, 211, 252, 0.28)",
      bottomColor: "rgba(125, 211, 252, 0.03)",
      lineWidth: 2,
    });

    const forecastSeries = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 3,
      lineStyle: 2,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#f59e0b",
      crosshairMarkerBackgroundColor: "#082f49",
    });

    const bandTopSeries = chart.addLineSeries({
      color: "rgba(249, 115, 22, 0.45)",
      lineWidth: 1,
    });

    const bandBottomSeries = chart.addLineSeries({
      color: "rgba(249, 115, 22, 0.45)",
      lineWidth: 1,
    });

    const historyData: AreaData[] = analysis.candles
      .slice(-80)
      .map((candle) => ({
        time: candle.time as AreaData["time"],
        value: candle.close,
      }));

    const forecastData: LineData[] = projection.map((point) => ({
      time: point.time as LineData["time"],
      value: point.value,
    }));

    const topBandData: LineData[] = projection.map((point) => ({
      time: point.time as LineData["time"],
      value: point.upper,
    }));

    const bottomBandData: LineData[] = projection.map((point) => ({
      time: point.time as LineData["time"],
      value: point.lower,
    }));

    historySeries.setData(historyData);

    const anchor = historyData[historyData.length - 1];
    if (anchor) {
      forecastSeries.setData([
        { time: anchor.time, value: anchor.value },
        ...forecastData,
      ]);
      bandTopSeries.setData([
        { time: anchor.time, value: anchor.value },
        ...topBandData,
      ]);
      bandBottomSeries.setData([
        { time: anchor.time, value: anchor.value },
        ...bottomBandData,
      ]);
    }

    chart.timeScale().fitContent();

    const onResize = () =>
      chart.applyOptions({ width: ref.current?.clientWidth ?? 900 });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [analysis, projection]);

  const confidenceLabel = `${Math.round(analysis.decision.confidence * 100)}% confidence`;
  const lastProjection = projection[projection.length - 1]?.value;
  const projectionDelta =
    typeof lastProjection === "number"
      ? ((lastProjection - analysis.quote.price) /
          Math.max(analysis.quote.price, 0.01)) *
        100
      : 0;

  return (
    <section className="prediction-card rounded-2xl p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-200">
            Stock Prediction
          </p>
          <h2 className="text-lg font-semibold text-white">
            Projected Trend Path
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-sky-300/30 bg-sky-200/10 px-3 py-1 text-sky-100">
            {confidenceLabel}
          </span>
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              projectionDelta >= 0
                ? "bg-emerald-300/20 text-emerald-100"
                : "bg-rose-300/20 text-rose-100"
            }`}
          >
            {projectionDelta >= 0 ? "+" : ""}
            {projectionDelta.toFixed(2)}%
          </span>
        </div>
      </div>
      <div ref={ref} />
      <p className="mt-3 text-xs text-sky-100/80">
        Solid line shows recent close prices. Dashed line is the model
        projection with widening uncertainty bands.
      </p>
    </section>
  );
}
