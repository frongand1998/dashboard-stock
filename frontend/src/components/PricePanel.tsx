import type { AnalysisResponse } from "../types/analysis";
import { useI18n } from "../lib/i18n";

interface Props {
  analysis: AnalysisResponse;
}

const signalConfig: Record<
  string,
  { label: string; bg: string; text: string; glow: string }
> = {
  BUY_NOW: {
    label: "BUY NOW",
    bg: "bg-positive",
    text: "text-white",
    glow: "ring-2 ring-positive/40",
  },
  HOLD: {
    label: "HOLD",
    bg: "bg-positive/20",
    text: "text-positive",
    glow: "",
  },
  WAIT: { label: "WAIT", bg: "bg-caution/20", text: "text-caution", glow: "" },
  AVOID: {
    label: "AVOID",
    bg: "bg-negative/20",
    text: "text-negative",
    glow: "",
  },
  SELL_NOW: {
    label: "SELL NOW",
    bg: "bg-negative",
    text: "text-white",
    glow: "ring-2 ring-negative/40",
  },
};

export function PricePanel({ analysis }: Props) {
  const { t } = useI18n();
  const q = analysis.quote;
  const priceValue = asFiniteNumber(q.price);
  const changePercentValue = asFiniteNumber(q.changePercent24h);
  const volumeValue = asFiniteNumber(q.volume24h);
  const volatilityValue = asFiniteNumber(q.volatility);
  const positive = (changePercentValue ?? 0) >= 0;
  const sig =
    signalConfig[analysis.decision.tradeSignal] ?? signalConfig["WAIT"];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{analysis.symbol}</h2>
        <p className="text-xs text-slate-500">
          {analysis.assetClass.toUpperCase()}
        </p>
      </div>

      <div className="mt-2 flex items-end gap-4">
        <p className="text-3xl font-bold text-ink">
          {formatNumber(priceValue)}
        </p>
        <span
          className={`mb-0.5 rounded-xl px-4 py-1.5 text-sm font-extrabold tracking-wide ${sig.bg} ${sig.text} ${sig.glow}`}
        >
          {sig.label}
        </span>
      </div>

      <p
        className={`text-sm font-semibold ${positive ? "text-positive" : "text-negative"}`}
      >
        {changePercentValue == null
          ? "-"
          : `${positive ? "+" : ""}${changePercentValue}%`}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Info label={t("price.volume")} value={formatNumber(volumeValue)} />
        <Info
          label={t("price.volatility")}
          value={formatFixed(volatilityValue, 4)}
        />
        <Info label={t("price.market")} value={q.marketStatus} />
        <Info
          label={t("price.data")}
          value={
            analysis.dataSource.delayed
              ? t("price.delayed", {
                  minutes: analysis.dataSource.delayMinutes,
                })
              : t("price.nearRealtime")
          }
        />
      </div>
    </section>
  );
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null): string {
  return value == null ? "-" : value.toLocaleString();
}

function formatFixed(value: number | null, digits: number): string {
  return value == null ? "-" : value.toFixed(digits);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
