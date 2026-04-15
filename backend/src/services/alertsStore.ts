import type {
  AlertDirection,
  AlertRule,
  AssetClass,
  TriggeredAlert,
} from "../types.js";

interface CreateAlertInput {
  symbol: string;
  assetClass: AssetClass;
  direction: AlertDirection;
  targetPrice: number;
}

const rules: AlertRule[] = [];
const history: TriggeredAlert[] = [];
const HISTORY_LIMIT = 200;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listAlerts(): AlertRule[] {
  return [...rules];
}

export function listTriggeredAlerts(limit = 50): TriggeredAlert[] {
  return history.slice(-limit).reverse();
}

export function recordTriggeredAlert(event: TriggeredAlert): void {
  history.push(event);
  if (history.length > HISTORY_LIMIT) {
    history.splice(0, history.length - HISTORY_LIMIT);
  }
}

export function createAlert(input: CreateAlertInput): AlertRule {
  const rule: AlertRule = {
    id: createId(),
    symbol: input.symbol.toUpperCase(),
    assetClass: input.assetClass,
    direction: input.direction,
    targetPrice: input.targetPrice,
    createdAt: new Date().toISOString(),
    active: true,
  };

  rules.push(rule);
  return rule;
}

export function deleteAlert(id: string): boolean {
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  rules.splice(idx, 1);
  return true;
}

export function evaluateAlerts(
  symbol: string,
  assetClass: AssetClass,
  price: number,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.symbol !== symbol.toUpperCase() || rule.assetClass !== assetClass)
      continue;

    const isTriggered =
      (rule.direction === "above" && price >= rule.targetPrice) ||
      (rule.direction === "below" && price <= rule.targetPrice);

    if (!isTriggered) continue;

    rule.active = false;
    const event: TriggeredAlert = {
      alertId: rule.id,
      symbol: rule.symbol,
      assetClass: rule.assetClass,
      direction: rule.direction,
      targetPrice: rule.targetPrice,
      triggerPrice: price,
      triggeredAt: new Date().toISOString(),
    };

    recordTriggeredAlert({ ...event, alertType: "price" });
    triggered.push(event);
  }

  return triggered;
}
