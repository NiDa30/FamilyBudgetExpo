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
      // ✅ 改善: 複数のキーでカテゴリマップを作成
      const categoryMap = new Map<string, { name: string; color?: string; icon?: string }>();
      categories.forEach((c) => {
        categoryMap.set(c.id, { name: c.name, color: c.color, icon: c.icon });
        // 追加のキーも登録（互換性のため）
        if ((c as any).categoryID) {
          categoryMap.set((c as any).categoryID, { name: c.name, color: c.color, icon: c.icon });
        }
        if ((c as any).category_id) {
          categoryMap.set((c as any).category_id, { name: c.name, color: c.color, icon: c.icon });
        }
      });

      // ✅ デバッグ: カテゴリと取引のカテゴリIDを確認
      const transactionCategoryIds = new Set<string>();
      transactions.forEach((t) => {
        const catId = t.categoryId || (t as any).category_id || (t as any).categoryID;
        if (catId) {
          transactionCategoryIds.add(String(catId));
        }
      });
      console.log(`📊 AnalyticsService: Found ${transactionCategoryIds.size} unique category IDs in transactions`);
      console.log(`📊 AnalyticsService: Available categories: ${categories.length}`);

      // カテゴリ別に集計
      const categoryTotals = new Map<string, number>();
      transactions.forEach((t) => {
        // ✅ 複数のフィールド名からcategoryIdを取得
        const categoryId = String(t.categoryId || (t as any).category_id || (t as any).categoryID || "uncategorized");
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
   * ✅ 改善: BudgetServiceを使用して正確な予算データを取得
   */
  static async checkBudgetAlerts(
    userId: UUID,
    monthYear: string
  ): Promise<BudgetAlert[]> {
    try {
      // BudgetServiceを使用して予算警告を取得
      const BudgetService = (await import("../budget/BudgetService")).default;
      const budgetAlerts = await BudgetService.checkBudgetAlerts(monthYear);

      // BudgetAlert形式に変換
      return budgetAlerts.map((alert) => ({
        categoryId: alert.categoryId,
        categoryName: alert.categoryName,
        budgetLimit: alert.budgetAmount,
        currentSpent: alert.spentAmount,
        percentage: alert.percentage,
        isOverLimit: alert.percentage >= 100,
        alertLevel: alert.alertLevel,
      }));
    } catch (error) {
      console.error("Error checking budget alerts:", error);
      return [];
    }
  }
}

