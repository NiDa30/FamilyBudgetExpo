// src/service/budget/BudgetService.ts
import { Budget } from "../../domain/types";
import { databaseService } from "../../database/databaseService";
import FirebaseService from "../firebase/FirebaseService";
import { authInstance as auth } from "../../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface BudgetTemplate {
  id: string;
  name: string;
  description?: string;
  isSystemDefault: boolean;
  userId?: string;
  allocations: {
    categoryId: string;
    percentage: number; // Percentage of monthly income
    fixedAmount?: number; // Fixed amount (optional)
  }[];
  createdAt: string;
}

export interface BudgetAnalysis {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  remainingAmount: number;
  isOverBudget: boolean;
  overspendReason?: {
    topTransactions: Array<{
      id: string;
      description: string;
      amount: number;
      date: string;
    }>;
    averageTransactionSize: number;
    transactionCount: number;
  };
}

export interface BudgetAlert {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  alertLevel: "warning" | "critical"; // 80% = warning, 100% = critical
  message: string;
  timestamp: string;
}

class BudgetService {
  private TEMPLATE_STORAGE_KEY = "@budget_templates";

  /**
   * カテゴリ別予算を作成・更新
   */
  async createOrUpdateBudget(
    categoryId: string,
    budgetAmount: number,
    monthYear: string,
    warningThreshold: number = 80
  ): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const budgetData = {
        categoryID: categoryId,
        monthYear,
        budgetAmount,
        spentAmount: 0,
        warningThreshold,
      };

      // SQLiteに保存
      await databaseService.ensureInitialized();
      let budgetId = await this.getBudgetId(user.uid, categoryId, monthYear);

      if (budgetId) {
        // 更新
        await databaseService.db.runAsync(
          `UPDATE BUDGET 
           SET budgetAmount = ?, warningThreshold = ?, updatedAt = ?
           WHERE budgetID = ?`,
          [budgetAmount, warningThreshold, new Date().toISOString(), budgetId]
        );
      } else {
        // 新規作成
        budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await databaseService.db.runAsync(
          `INSERT INTO BUDGET (budgetID, userID, categoryID, monthYear, budgetAmount, spentAmount, warningThreshold, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            budgetId,
            user.uid,
            categoryId,
            monthYear,
            budgetAmount,
            0,
            warningThreshold,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }

      // Firebaseに同期
      try {
        await FirebaseService.addBudget(user.uid, {
          categoryID: categoryId,
          monthYear,
          budgetAmount,
          spentAmount: 0,
          warningThreshold,
        });
      } catch (firebaseError) {
        console.warn("Failed to sync budget to Firebase:", firebaseError);
      }

      return budgetId;
    } catch (error) {
      console.error("Error creating/updating budget:", error);
      throw error;
    }
  }

  /**
   * 予算IDを取得
   */
  private async getBudgetId(
    userId: string,
    categoryId: string,
    monthYear: string
  ): Promise<string | null> {
    try {
      const result = await databaseService.db.getFirstAsync<{ budgetID: string }>(
        `SELECT budgetID FROM BUDGET 
         WHERE userID = ? AND categoryID = ? AND monthYear = ?`,
        [userId, categoryId, monthYear]
      );
      return result?.budgetID || null;
    } catch (error) {
      console.error("Error getting budget ID:", error);
      return null;
    }
  }

  /**
   * 月の予算一覧を取得
   */
  async getBudgetsByMonth(monthYear: string): Promise<Budget[]> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      await databaseService.ensureInitialized();
      const budgets = await databaseService.db.getAllAsync<{
        budgetID: string;
        categoryID: string;
        budgetAmount: number;
        spentAmount: number;
        warningThreshold: number;
      }>(
        `SELECT budgetID, categoryID, budgetAmount, spentAmount, warningThreshold
         FROM BUDGET 
         WHERE userID = ? AND monthYear = ?`,
        [user.uid, monthYear]
      );

      return budgets.map((b) => ({
        id: b.budgetID,
        userId: user.uid,
        categoryId: b.categoryID,
        monthYear,
        budgetAmount: b.budgetAmount,
        spentAmount: b.spentAmount || 0,
        warningThreshold: b.warningThreshold,
      }));
    } catch (error) {
      console.error("Error getting budgets:", error);
      return [];
    }
  }

  /**
   * カテゴリ別の実際の支出を計算
   */
  async calculateActualSpending(
    categoryId: string,
    monthYear: string
  ): Promise<number> {
    try {
      const user = auth.currentUser;
      if (!user) return 0;

      const [year, month] = monthYear.split("-");
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      await databaseService.ensureInitialized();
      const transactions = await databaseService.getTransactionsByUser(user.uid, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        categoryId,
        type: "EXPENSE",
      });

      return transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    } catch (error) {
      console.error("Error calculating actual spending:", error);
      return 0;
    }
  }

  /**
   * 予算の分析（超過原因を含む）
   */
  async analyzeBudget(
    categoryId: string,
    monthYear: string
  ): Promise<BudgetAnalysis | null> {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const budgets = await this.getBudgetsByMonth(monthYear);
      const budget = budgets.find((b) => b.categoryId === categoryId);
      if (!budget) return null;

      const spentAmount = await this.calculateActualSpending(categoryId, monthYear);

      // 予算の更新（実際の支出額を反映）
      await this.updateSpentAmount(budget.id, spentAmount);

      // 超過原因の分析
      let overspendReason;
      if (spentAmount > budget.budgetAmount) {
        const [year, month] = monthYear.split("-");
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

        const transactions = await databaseService.getTransactionsByUser(user.uid, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          categoryId,
          type: "EXPENSE",
        });

        const sortedTransactions = transactions
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5);

        const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const averageSize = transactions.length > 0 ? totalAmount / transactions.length : 0;

        overspendReason = {
          topTransactions: sortedTransactions.map((t) => ({
            id: t.id,
            description: t.description || "Không có mô tả",
            amount: t.amount || 0,
            date: t.date,
          })),
          averageTransactionSize: averageSize,
          transactionCount: transactions.length,
        };
      }

      // カテゴリ情報を取得
      const categories = await databaseService.getCategoriesByUser(user.uid);
      const category = categories.find((c) => c.id === categoryId || c.categoryID === categoryId);

      return {
        categoryId,
        categoryName: category?.name || "Không xác định",
        budgetAmount: budget.budgetAmount,
        spentAmount,
        percentage: budget.budgetAmount > 0 ? (spentAmount / budget.budgetAmount) * 100 : 0,
        remainingAmount: Math.max(0, budget.budgetAmount - spentAmount),
        isOverBudget: spentAmount > budget.budgetAmount,
        overspendReason,
      };
    } catch (error) {
      console.error("Error analyzing budget:", error);
      return null;
    }
  }

  /**
   * 支出額を更新
   */
  private async updateSpentAmount(budgetId: string, spentAmount: number): Promise<void> {
    try {
      await databaseService.db.runAsync(
        `UPDATE BUDGET SET spentAmount = ?, updatedAt = ? WHERE budgetID = ?`,
        [spentAmount, new Date().toISOString(), budgetId]
      );
    } catch (error) {
      console.error("Error updating spent amount:", error);
    }
  }

  /**
   * 予算警告をチェック（80%と100%）
   */
  async checkBudgetAlerts(monthYear: string): Promise<BudgetAlert[]> {
    try {
      const budgets = await this.getBudgetsByMonth(monthYear);
      const alerts: BudgetAlert[] = [];

      for (const budget of budgets) {
        const analysis = await this.analyzeBudget(budget.categoryId, monthYear);
        if (!analysis) continue;

        const percentage = analysis.percentage;
        if (percentage >= 100) {
          // 100%超過 = クリティカル
          alerts.push({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName: analysis.categoryName,
            budgetAmount: budget.budgetAmount,
            spentAmount: analysis.spentAmount,
            percentage,
            alertLevel: "critical",
            message: `Đã vượt quá ngân sách ${analysis.categoryName}! Đã chi ${analysis.spentAmount.toLocaleString("vi-VN")}₫ trong khi ngân sách là ${budget.budgetAmount.toLocaleString("vi-VN")}₫`,
            timestamp: new Date().toISOString(),
          });
        } else if (percentage >= 80) {
          // 80%以上 = 警告
          alerts.push({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName: analysis.categoryName,
            budgetAmount: budget.budgetAmount,
            spentAmount: analysis.spentAmount,
            percentage,
            alertLevel: "warning",
            message: `Cảnh báo: Đã sử dụng ${percentage.toFixed(0)}% ngân sách ${analysis.categoryName}. Còn lại ${analysis.remainingAmount.toLocaleString("vi-VN")}₫`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return alerts.sort((a, b) => b.percentage - a.percentage);
    } catch (error) {
      console.error("Error checking budget alerts:", error);
      return [];
    }
  }

  /**
   * 50/30/20ルールに基づく予算提案
   */
  async suggestBudgetByRule(
    monthlyIncome: number,
    monthYear: string
  ): Promise<{
    needs: number;
    wants: number;
    savings: number;
  }> {
    return {
      needs: monthlyIncome * 0.5, // 50%
      wants: monthlyIncome * 0.3, // 30%
      savings: monthlyIncome * 0.2, // 20%
    };
  }

  /**
   * 予算テンプレートを保存
   */
  async saveBudgetTemplate(template: Omit<BudgetTemplate, "id" | "createdAt">): Promise<string> {
    try {
      const user = auth.currentUser;
      const templates = await this.getBudgetTemplates();

      const newTemplate: BudgetTemplate = {
        ...template,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        userId: user?.uid,
      };

      templates.push(newTemplate);
      await AsyncStorage.setItem(this.TEMPLATE_STORAGE_KEY, JSON.stringify(templates));

      return newTemplate.id;
    } catch (error) {
      console.error("Error saving budget template:", error);
      throw error;
    }
  }

  /**
   * 予算テンプレート一覧を取得
   */
  async getBudgetTemplates(): Promise<BudgetTemplate[]> {
    try {
      const stored = await AsyncStorage.getItem(this.TEMPLATE_STORAGE_KEY);
      if (!stored) {
        // デフォルトテンプレートを返す
        return this.getDefaultTemplates();
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error("Error getting budget templates:", error);
      return this.getDefaultTemplates();
    }
  }

  /**
   * デフォルトテンプレート
   */
  private getDefaultTemplates(): BudgetTemplate[] {
    return [
      {
        id: "template_50_30_20",
        name: "Quy tắc 50/30/20",
        description: "Ngân sách theo quy tắc 50/30/20 (Nhu cầu/ Mong muốn/ Tiết kiệm)",
        isSystemDefault: true,
        allocations: [
          { categoryId: "needs", percentage: 50 },
          { categoryId: "wants", percentage: 30 },
          { categoryId: "savings", percentage: 20 },
        ],
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * テンプレートから予算を適用
   */
  async applyTemplate(templateId: string, monthlyIncome: number, monthYear: string): Promise<void> {
    try {
      const templates = await this.getBudgetTemplates();
      const template = templates.find((t) => t.id === templateId);
      if (!template) throw new Error("Template not found");

      // テンプレートの割り当てに基づいて予算を作成
      // 注意: 実際の実装では、カテゴリIDのマッピングが必要
      for (const allocation of template.allocations) {
        const budgetAmount = allocation.fixedAmount || (monthlyIncome * allocation.percentage) / 100;
        // ここで実際のカテゴリIDを使用する必要があります
        // 簡略化のため、スキップします
      }
    } catch (error) {
      console.error("Error applying template:", error);
      throw error;
    }
  }
}

export default new BudgetService();

