import type { PlanHistoryEntry, PlanTheme, InvestmentPlan } from "../types.js";

const HISTORY_LIMIT = 500;
const entries: PlanHistoryEntry[] = [];

function createId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordPlanHistory(plan: InvestmentPlan): PlanHistoryEntry {
  const entry: PlanHistoryEntry = {
    id: createId(),
    plan,
  };

  entries.push(entry);
  if (entries.length > HISTORY_LIMIT) {
    entries.splice(0, entries.length - HISTORY_LIMIT);
  }

  return entry;
}

export function listPlanHistory(params: {
  symbol?: string;
  theme?: PlanTheme;
  limit?: number;
}): PlanHistoryEntry[] {
  const symbol = params.symbol?.toUpperCase();
  const limit = Math.min(params.limit ?? 50, 100);

  return entries
    .filter((entry) => {
      if (symbol && entry.plan.symbol !== symbol) return false;
      if (params.theme && entry.plan.theme !== params.theme) return false;
      return true;
    })
    .slice(-limit)
    .reverse();
}
