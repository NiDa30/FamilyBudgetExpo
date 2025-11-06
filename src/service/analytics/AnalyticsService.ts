// src/service/analytics/AnalyticsService.ts
import { Transaction, Category, UUID, DateRange } from "../../domain/types";
import { TransactionService } from "../transactions";
import { CategoryRepository } from "../../database/repositories";

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color?: string;
  icon?: string;
}

export interface PeriodSummary {
  period: string; // "2024-01", "2024-W01", etc.
  income: number;
  expense: number;
  balance: number;
}

export interface TrendData {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  budgetLimit: number;
  currentSpent: number;
  percentage: number;
  isOverLimit: boolean;
  alertLevel: "warning" | "critical";
}

export class AnalyticsService {
  /**
   * 期間内の総収入と総支出を計算
   */
  static async getTotals(
    userId: UUID,
    range: DateRange
  ): Promise<{ income: number; expense: number; balance: number }> {
    try {
      const [incomes, expenses] = await Promise.all([
        TransactionService.query(userId, {
          range,
          type: "INCOME",
        }),
        TransactionService.query(userId, {
          range,
          type: "EXPENSE",
        }),
      ]);

      const income = incomes.reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);
      const balance = income - expense;

      return { income, expense, balance };
    } catch (error) {
      console.error("Error calculating totals:", error);
      return { income: 0, expense: 0, balance: 0 };
    }
  }

  /**
   * カテゴリ別の支出分布を計算
   */
  static async getCategoryDistribution(
    userId: UUID,
    range: DateRange,
    type: "INCOME" | "EXPENSE"
  ): Promise<CategorySummary[]> {
    try {
      const transactions = await TransactionService.query(userId, {
        range,
        type,
      });

      const categories = await CategoryRepository.listByUser(userId);
      const categoryMap = new Map(
        categories.map((c) => [c.id, { name: c.name, color: c.color, icon: c.icon }])
      );

      // カテゴリ別に集計
      const categoryTotals = new Map<string, number>();
      transactions.forEach((t) => {
        const categoryId = t.categoryId || "uncategorized";
        const current = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, current + (t.amount || 0));
      });

      const total = Array.from(categoryTotals.values()).reduce(
        (sum, amount) => sum + amount,
        0
      );

      // カテゴリサマリーを作成
      const summaries: CategorySummary[] = Array.from(
        categoryTotals.entries()
      ).map(([categoryId, amount]) => {
        const categoryInfo = categoryMap.get(categoryId) || {
          name: "Chưa phân loại",
          color: "#9E9E9E",
          icon: "tag",
        };

        return {
          categoryId,
          categoryName: categoryInfo.name,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: categoryInfo.color,
          icon: categoryInfo.icon,
        };
      });

      // 金額の降順でソート
      return summaries.sort((a, b) => b.amount - a.amount);
    } catch (error) {
      console.error("Error calculating category distribution:", error);
      return [];
    }
  }

  /**
   * 時系列データを取得（トレンド分析用）
   */
  static async getTrendData(
    userId: UUID,
    period: "week" | "month" | "quarter" | "year"
  ): Promise<TrendData[]> {
    try {
      const now = new Date();
      let startDate: Date;
      let intervalDays: number;

      switch (period) {
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          intervalDays = 1;
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          intervalDays = 7;
          break;
        case "quarter":
          startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          intervalDays = 30;
          break;
        case "year":
          startDate = new Date(now.getFullYear() - 2, 0, 1);
          intervalDays = 30;
          break;
        default:
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 6);
          intervalDays = 30;
      }

      const trendData: TrendData[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= now) {
        const periodEnd = new Date(currentDate);
        periodEnd.setDate(periodEnd.getDate() + intervalDays);

        const range: DateRange = {
          start: currentDate.toISOString(),
          end: periodEnd.toISOString(),
        };

        const totals = await this.getTotals(userId, range);

        trendData.push({
          date: currentDate.toISOString().split("T")[0],
          income: totals.income,
          expense: totals.expense,
          balance: totals.balance,
        });

        currentDate.setDate(currentDate.getDate() + intervalDays);
      }

      return trendData;
    } catch (error) {
      console.error("Error getting trend data:", error);
      return [];
    }
  }

  /**
   * 月次比較データを取得（棒グラフ用）
   */
  static async getMonthlyComparison(
    userId: UUID,
    months: number = 6
  ): Promise<PeriodSummary[]> {
    try {
      const summaries: PeriodSummary[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        const range: DateRange = {
          start: start.toISOString(),
          end: end.toISOString(),
        };

        const totals = await this.getTotals(userId, range);

        summaries.push({
          period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          income: totals.income,
          expense: totals.expense,
          balance: totals.balance,
        });
      }

      return summaries;
    } catch (error) {
      console.error("Error getting monthly comparison:", error);
      return [];
    }
  }

  /**
   * 予算超過アラートをチェック
   */
  static async checkBudgetAlerts(
    userId: UUID,
    monthYear: string
  ): Promise<BudgetAlert[]> {
    try {
      // TODO: BudgetRepositoryから予算を取得
      // 現在はカテゴリ別の支出をチェック
      const [start, end] = monthYear.split("-");
      const startDate = new Date(parseInt(start), parseInt(end) - 1, 1);
      const endDate = new Date(parseInt(start), parseInt(end), 0, 23, 59, 59);

      const range: DateRange = {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      };

      const categoryDistribution = await this.getCategoryDistribution(
        userId,
        range,
        "EXPENSE"
      );

      // 仮の予算制限（実際にはBudgetRepositoryから取得）
      const alerts: BudgetAlert[] = categoryDistribution
        .filter((cat) => cat.amount > 0)
        .map((cat) => {
          // 仮の予算制限を計算（実際の実装ではBudgetRepositoryから取得）
          const estimatedBudget = cat.amount * 1.2; // 20%余裕を持たせる
          const percentage = (cat.amount / estimatedBudget) * 100;
          const isOverLimit = percentage >= 100;
          const alertLevel =
            percentage >= 100 ? "critical" : percentage >= 90 ? "warning" : "warning";

          return {
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            budgetLimit: estimatedBudget,
            currentSpent: cat.amount,
            percentage,
            isOverLimit,
            alertLevel,
          };
        })
        .filter((alert) => alert.percentage >= 80) // 80%以上の場合のみアラート
        .sort((a, b) => b.percentage - a.percentage);

      return alerts;
    } catch (error) {
      console.error("Error checking budget alerts:", error);
      return [];
    }
  }
}

