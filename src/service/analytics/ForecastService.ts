// src/service/analytics/ForecastService.ts - Dự báo dựa trên dữ liệu lịch sử
import { Transaction } from "../../domain/types";
import databaseService from "../../database/databaseService";

export interface ForecastData {
  period: string;
  predictedIncome: number;
  predictedExpense: number;
  confidence: number; // 0-100
  trend: "increasing" | "decreasing" | "stable";
}

export interface ForecastInsight {
  type: "warning" | "info" | "success";
  message: string;
  action?: string;
}

export class ForecastService {
  /**
   * Dự báo thu nhập và chi tiêu cho kỳ tiếp theo dựa trên dữ liệu lịch sử
   */
  static async forecastNextPeriod(
    userId: string,
    period: "week" | "month" | "quarter" | "year"
  ): Promise<ForecastData[]> {
    try {
      const now = new Date();
      const historicalData: { period: string; income: number; expense: number }[] = [];

      // Lấy dữ liệu lịch sử (6-12 kỳ trước)
      const periodsToAnalyze = period === "week" ? 12 : period === "month" ? 12 : period === "quarter" ? 8 : 4;

      for (let i = periodsToAnalyze; i >= 1; i--) {
        let start: Date;
        let end: Date;

        switch (period) {
          case "week":
            start = new Date(now);
            start.setDate(now.getDate() - (i * 7));
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            break;
          case "month":
            start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            break;
          case "quarter":
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), (quarter - i) * 3, 1);
            end = new Date(now.getFullYear(), (quarter - i + 1) * 3, 0, 23, 59, 59);
            break;
          case "year":
            start = new Date(now.getFullYear() - i, 0, 1);
            end = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
            break;
        }

        const transactions = await databaseService.getTransactionsByUser(userId, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        let income = 0;
        let expense = 0;
        if (Array.isArray(transactions)) {
          transactions.forEach((txn: any) => {
            const amount = parseFloat(txn.amount) || 0;
            if (txn.type === "INCOME") {
              income += amount;
            } else if (txn.type === "EXPENSE") {
              expense += amount;
            }
          });
        }

        historicalData.push({
          period: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
          income,
          expense,
        });
      }

      // Tính toán dự báo sử dụng moving average và trend analysis
      const forecasts: ForecastData[] = [];
      const nextPeriods = 3; // Dự báo 3 kỳ tiếp theo

      for (let i = 1; i <= nextPeriods; i++) {
        // Simple moving average với trọng số (gần đây hơn = trọng số cao hơn)
        let weightedIncome = 0;
        let weightedExpense = 0;
        let totalWeight = 0;

        historicalData.forEach((data, index) => {
          const weight = index + 1; // Gần đây hơn = trọng số cao hơn
          weightedIncome += data.income * weight;
          weightedExpense += data.expense * weight;
          totalWeight += weight;
        });

        const avgIncome = totalWeight > 0 ? weightedIncome / totalWeight : 0;
        const avgExpense = totalWeight > 0 ? weightedExpense / totalWeight : 0;

        // Tính trend (tăng/giảm/ổn định)
        let trend: "increasing" | "decreasing" | "stable" = "stable";
        if (historicalData.length >= 3) {
          const recent = historicalData.slice(-3);
          const recentAvgIncome = recent.reduce((sum, d) => sum + d.income, 0) / recent.length;
          const recentAvgExpense = recent.reduce((sum, d) => sum + d.expense, 0) / recent.length;
          const older = historicalData.slice(0, -3);
          const olderAvgIncome = older.length > 0 ? older.reduce((sum, d) => sum + d.income, 0) / older.length : recentAvgIncome;
          const olderAvgExpense = older.length > 0 ? older.reduce((sum, d) => sum + d.expense, 0) / older.length : recentAvgExpense;

          const incomeChange = ((recentAvgIncome - olderAvgIncome) / (olderAvgIncome || 1)) * 100;
          const expenseChange = ((recentAvgExpense - olderAvgExpense) / (olderAvgExpense || 1)) * 100;

          if (Math.abs(expenseChange) > 5) {
            trend = expenseChange > 0 ? "increasing" : "decreasing";
          }
        }

        // Áp dụng trend adjustment
        const trendMultiplier = trend === "increasing" ? 1.05 : trend === "decreasing" ? 0.95 : 1.0;
        const predictedIncome = avgIncome * Math.pow(trendMultiplier, i);
        const predictedExpense = avgExpense * Math.pow(trendMultiplier, i);

        // Confidence dựa trên số lượng dữ liệu và độ biến thiên
        const variance = this.calculateVariance(historicalData.map((d) => d.expense));
        const confidence = Math.max(50, Math.min(95, 100 - variance / 1000));

        // Tính period label
        let periodLabel: string;
        switch (period) {
          case "week":
            const weekDate = new Date(now);
            weekDate.setDate(now.getDate() + (i * 7));
            periodLabel = `Tuần ${weekDate.getDate()}/${weekDate.getMonth() + 1}`;
            break;
          case "month":
            const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
            periodLabel = `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
            break;
          case "quarter":
            const quarterDate = new Date(now.getFullYear(), now.getMonth() + (i * 3), 1);
            periodLabel = `Q${Math.floor(quarterDate.getMonth() / 3) + 1}/${quarterDate.getFullYear()}`;
            break;
          case "year":
            periodLabel = `${now.getFullYear() + i}`;
            break;
        }

        forecasts.push({
          period: periodLabel,
          predictedIncome,
          predictedExpense,
          confidence: Math.round(confidence),
          trend,
        });
      }

      return forecasts;
    } catch (error) {
      console.error("Error forecasting:", error);
      return [];
    }
  }

  /**
   * Tính phương sai để đánh giá độ tin cậy
   */
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Tạo insights và gợi ý dựa trên dự báo
   */
  static generateInsights(forecasts: ForecastData[], currentIncome: number, currentExpense: number): ForecastInsight[] {
    const insights: ForecastInsight[] = [];

    if (forecasts.length === 0) return insights;

    const nextForecast = forecasts[0];

    // Cảnh báo nếu chi tiêu dự báo vượt quá thu nhập
    if (nextForecast.predictedExpense > nextForecast.predictedIncome) {
      insights.push({
        type: "warning",
        message: `Dự báo chi tiêu (${this.formatCurrency(nextForecast.predictedExpense)}) sẽ vượt quá thu nhập (${this.formatCurrency(nextForecast.predictedIncome)}) trong kỳ tiếp theo.`,
        action: "Điều chỉnh ngân sách",
      });
    }

    // Cảnh báo nếu xu hướng tăng mạnh
    if (nextForecast.trend === "increasing" && nextForecast.predictedExpense > currentExpense * 1.1) {
      insights.push({
        type: "warning",
        message: `Chi tiêu đang có xu hướng tăng mạnh. Dự báo tăng ${((nextForecast.predictedExpense / currentExpense - 1) * 100).toFixed(1)}% so với hiện tại.`,
        action: "Xem xét cắt giảm chi tiêu",
      });
    }

    // Thông tin tích cực nếu xu hướng giảm
    if (nextForecast.trend === "decreasing" && nextForecast.predictedExpense < currentExpense) {
      insights.push({
        type: "success",
        message: `Chi tiêu đang có xu hướng giảm. Dự báo giảm ${((1 - nextForecast.predictedExpense / currentExpense) * 100).toFixed(1)}% so với hiện tại.`,
      });
    }

    // Gợi ý tiết kiệm
    const savingsPotential = nextForecast.predictedIncome - nextForecast.predictedExpense;
    if (savingsPotential > 0 && savingsPotential > nextForecast.predictedIncome * 0.2) {
      insights.push({
        type: "info",
        message: `Bạn có thể tiết kiệm ${this.formatCurrency(savingsPotential)} trong kỳ tiếp theo (${((savingsPotential / nextForecast.predictedIncome) * 100).toFixed(1)}% thu nhập).`,
        action: "Thiết lập mục tiêu tiết kiệm",
      });
    }

    return insights;
  }

  private static formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  }
}

