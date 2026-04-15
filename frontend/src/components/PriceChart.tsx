import {
  createChart,
  type CandlestickData,
  ColorType,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { AnalysisResponse } from "../types/analysis";

interface Props {
  analysis: AnalysisResponse;
}

export function PriceChart({ analysis }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#334155",
      },
      grid: {
        horzLines: { color: "#f1f5f9" },
        vertLines: { color: "#f1f5f9" },
      },
      width: ref.current.clientWidth,
      height: 320,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    const candles: CandlestickData[] = analysis.candles.map((candle) => ({
      time: candle.time as CandlestickData["time"],
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    series.setData(candles);

    if (candles.length > 12) {
      series.setMarkers([
        {
          time: candles[Math.max(0, candles.length - 30)]?.time,
          position: "belowBar",
          color: "#22c55e",
          shape: "arrowUp",
          text: "News bullish",
        },
        {
          time: candles[Math.max(0, candles.length - 12)]?.time,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: "Risk headline",
        },
      ]);
    }

    const onResize = () =>
      chart.applyOptions({ width: ref.current?.clientWidth ?? 900 });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [analysis]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <div ref={ref} />
    </section>
  );
}
