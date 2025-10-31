import { Money } from "../domain/types";

export interface RuleConfig {
  needsPercent: number; // 50
  wantsPercent: number; // 30
  savingsPercent: number; // 20
}

export interface SpendSummary {
  monthlyIncome: Money;
  lastMonthsExpenses: { month: string; total: Money }[]; // last 3-6 months
  categoryTotals?: Record<string, Money>; // optional breakdown
}

export interface BudgetSuggestion {
  limits: {
    NEEDS: Money;
    WANTS: Money;
    SAVINGS: Money;
  };
  trendAdjustment: number; // -0.1 .. +0.1 applied to WANTS by default
  warnings: string[];
}

export function suggestByRule(
  summary: SpendSummary,
  rule: RuleConfig
): BudgetSuggestion {
  const income = Math.max(0, summary.monthlyIncome || 0);
  const base = {
    NEEDS: (income * rule.needsPercent) / 100,
    WANTS: (income * rule.wantsPercent) / 100,
    SAVINGS: (income * rule.savingsPercent) / 100,
  };

  // Simple trend: compare last month vs avg of previous
  const expenses = summary.lastMonthsExpenses || [];
  let trendAdj = 0;
  if (expenses.length >= 3) {
    const last = expenses[expenses.length - 1].total;
    const prev =
      expenses.slice(0, -1).reduce((s, e) => s + e.total, 0) /
      (expenses.length - 1);
    if (prev > 0) {
      const growth = (last - prev) / prev; // e.g. 0.12
      // dampen adjustment
      trendAdj = Math.max(-0.1, Math.min(0.1, growth * 0.5));
    }
  }

  const adjustedWants = Math.max(0, base.WANTS * (1 - trendAdj));
  const delta = base.WANTS - adjustedWants;
  // Move delta to SAVINGS when cutting WANTS; when negative, reduce SAVINGS first
  const savings = Math.max(0, base.SAVINGS + delta);
  const limits = { NEEDS: base.NEEDS, WANTS: adjustedWants, SAVINGS: savings };

  const warnings: string[] = [];
  if (limits.SAVINGS < income * 0.1) {
    warnings.push("Savings under 10% of income; consider reducing wants.");
  }
  if (summary.categoryTotals) {
    const food = summary.categoryTotals["Food"] || 0;
    if (food > limits.NEEDS * 0.5)
      warnings.push("Food spending exceeds 50% of needs budget.");
  }

  return { limits, trendAdjustment: trendAdj, warnings };
}

export function overspendAlert(
  currentSpent: Money,
  limit: Money,
  thresholdPercent = 0.9
): boolean {
  if (limit <= 0) return false;
  return currentSpent / limit >= thresholdPercent;
}
