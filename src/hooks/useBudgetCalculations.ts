/**
 * useBudgetCalculations Hook
 * Handles budget-related calculations and logic
 * Extracted from Bieudo.tsx
 */

import { useState, useCallback, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { AnalyticsService } from '../service/analytics/AnalyticsService';
import databaseService from '../database/databaseService';

export interface BudgetRule {
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  severity: 'warning' | 'danger';
}

export interface CategoryBudget {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface UseBudgetCalculationsReturn {
  budgetRule: BudgetRule;
  budgetAlerts: BudgetAlert[];
  categoryBudgets: CategoryBudget[];
  monthlyIncome: number;
  loading: boolean;
  updateBudgetRule: (rule: BudgetRule) => Promise<void>;
  loadBudgetData: () => Promise<void>;
}

/**
 * Hook to manage budget calculations
 */
export const useBudgetCalculations = (): UseBudgetCalculationsReturn => {
  const [budgetRule, setBudgetRule] = useState<BudgetRule>({
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
  });
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(false);

  // Retry helper
  const retryDbOperation = async <T,>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 100
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (
          (errorMessage.includes('database is locked') ||
            errorMessage.includes('finalizeAsync')) &&
          i < maxRetries - 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  };

  // Load budget data
  const loadBudgetData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user?.uid) return;

      const currentDate = new Date();
      const monthYear = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, '0')}`;

      // Load budget alerts
      const alerts = await AnalyticsService.checkBudgetAlerts(user.uid, monthYear);
      setBudgetAlerts(alerts);

      // Load user data and budgets
      const FirebaseService = (await import('../service/firebase/FirebaseService')).default;
      const [userData, budgets] = await Promise.all([
        FirebaseService.getUser(user.uid),
        FirebaseService.getBudgets(user.uid),
      ]);

      if (userData) {
        setMonthlyIncome((userData as any).monthlyIncome || 0);

        // Load budget rule
        if ((userData as any).budgetRule) {
          const ruleParts = (userData as any).budgetRule.split('-');
          if (ruleParts.length === 3) {
            setBudgetRule({
              needsPercent: parseInt(ruleParts[0]) || 50,
              wantsPercent: parseInt(ruleParts[1]) || 30,
              savingsPercent: parseInt(ruleParts[2]) || 20,
            });
          }
        }
      }

      // Calculate category budgets
      if (budgets && Array.isArray(budgets)) {
        const currentMonthBudgets = budgets.filter(
          (b: any) => b.monthYear === monthYear || b.month_year === monthYear
        );

        // Get current month expenses by category
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const monthEnd = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
          23,
          59,
          59
        ).toISOString();

        const monthTransactions = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: monthStart,
            endDate: monthEnd,
            type: 'EXPENSE',
          });
        });

        // Calculate spent per category
        const categorySpentMap = new Map<string, number>();
        if (Array.isArray(monthTransactions)) {
          monthTransactions.forEach((txn: any) => {
            const categoryId = txn.category_id || txn.categoryID;
            const amount = parseFloat(txn.amount) || 0;
            categorySpentMap.set(categoryId, (categorySpentMap.get(categoryId) || 0) + amount);
          });
        }

        // Load categories for names/colors
        const CategoryService = (await import('../services/categoryService')).default;
        const categories = await CategoryService.getCombinedCategories(user.uid);

        const budgetsWithSpending = currentMonthBudgets.map((budget: any) => {
          const categoryId = budget.categoryID || budget.category_id;
          const budgetAmount = budget.budgetAmount || budget.budget_amount || 0;
          const spentAmount = categorySpentMap.get(categoryId) || 0;
          const remainingAmount = budgetAmount - spentAmount;
          const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;

          const category = categories.find((c: any) => c.id === categoryId);

          return {
            categoryId,
            categoryName: category?.name || 'Unknown',
            budgetAmount,
            spentAmount,
            remainingAmount,
            percentage,
            color: category?.color || '#757575',
            icon: category?.icon || 'tag',
          };
        });

        setCategoryBudgets(budgetsWithSpending);
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update budget rule
  const updateBudgetRule = useCallback(async (rule: BudgetRule) => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const FirebaseService = (await import('../service/firebase/FirebaseService')).default;
      await FirebaseService.updateUser(user.uid, {
        budgetRule: `${rule.needsPercent}-${rule.wantsPercent}-${rule.savingsPercent}`,
      });

      setBudgetRule(rule);
    } catch (error) {
      console.error('Error updating budget rule:', error);
      throw error;
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadBudgetData();
  }, []);

  return {
    budgetRule,
    budgetAlerts,
    categoryBudgets,
    monthlyIncome,
    loading,
    updateBudgetRule,
    loadBudgetData,
  };
};

export default useBudgetCalculations;
