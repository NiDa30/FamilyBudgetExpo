/**
 * useFinancialData Hook
 * Centralized hook for loading and managing financial data
 * Extracted from Bieudo.tsx to reduce complexity
 */

import { useState, useCallback, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import databaseService from '../database/databaseService';
import { Category, Transaction } from '../domain/types';
import { CategoryRepository } from '../database/repositories';
import { mapRowToTransaction } from '../domain/mappers';

export type PeriodType = 'week' | 'month' | 'quarter' | 'year';

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface CategoryDistribution {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface MonthlyData {
  period: string;
  income: number;
  expense: number;
  balance: number;
}

export interface TrendData {
  date: string;
  income: number;
  expense: number;
}

export interface UseFinancialDataReturn {
  // Loading state
  loading: boolean;
  
  // Data
  summary: FinancialSummary;
  categories: Category[];
  transactions: Transaction[];
  expenseCategories: CategoryDistribution[];
  incomeCategories: CategoryDistribution[];
  monthlyComparison: MonthlyData[];
  trendData: TrendData[];
  
  // Functions
  loadData: () => Promise<void>;
  getDateRange: () => { start: string; end: string };
}

/**
 * Hook to manage financial data
 */
export const useFinancialData = (
  selectedPeriod: PeriodType = 'month',
  selectedCategoryFilter: string | null = null
): UseFinancialDataReturn => {
  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryDistribution[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryDistribution[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  // Calculate date range based on selected period
  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();

    switch (selectedPeriod) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        end.setMilliseconds(999);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [selectedPeriod]);

  // Retry helper for database operations
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

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user?.uid) {
        console.warn('User not authenticated');
        setLoading(false);
        return;
      }

      await retryDbOperation(async () => {
        await databaseService.ensureInitialized();
      });

      // Load categories
      try {
        const CategoryService = (await import('../services/categoryService')).default;
        const combinedCategories = await CategoryService.getCombinedCategories(user.uid);
        
        if (Array.isArray(combinedCategories) && combinedCategories.length > 0) {
          setCategories(combinedCategories as Category[]);
        } else {
          // Fallback
          const cats = await retryDbOperation(async () => {
            return await CategoryRepository.listByUser(user.uid);
          });
          setCategories(cats);
        }
      } catch (error) {
        console.warn('Failed to load categories:', error);
      }

      const range = getDateRange();

      // Load transactions
      const options: any = {
        startDate: range.start,
        endDate: range.end,
      };
      if (selectedCategoryFilter) {
        options.categoryId = selectedCategoryFilter;
      }

      const allTransactionsRaw = await retryDbOperation(async () => {
        return await databaseService.getTransactionsByUser(user.uid, options);
      });

      if (!Array.isArray(allTransactionsRaw)) {
        setLoading(false);
        return;
      }

      const allTransactions: Transaction[] = allTransactionsRaw.map((row: any) =>
        mapRowToTransaction(row)
      );

      setTransactions(allTransactions);

      // Calculate summary
      let income = 0;
      let expense = 0;
      allTransactions.forEach((txn) => {
        const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)) || 0;
        if (txn.type === 'INCOME') {
          income += amount;
        } else if (txn.type === 'EXPENSE') {
          expense += amount;
        }
      });

      setSummary({
        totalIncome: income,
        totalExpense: expense,
        balance: income - expense,
      });

      // Calculate category distributions
      const getCategoryInfo = (categoryId: string | null | undefined) => {
        if (!categoryId) {
          return { name: 'Không phân loại', icon: 'tag', color: '#9E9E9E' };
        }
        const category = categories.find((cat) => cat.id === categoryId);
        return {
          name: category?.name || 'Không phân loại',
          icon: category?.icon || 'tag',
          color: category?.color || '#9E9E9E',
        };
      };

      // Expense distribution
      const expenseTransactions = allTransactions.filter((t) => t.type === 'EXPENSE');
      const expenseCategoryMap = new Map<string, { amount: number; name: string; color: string; icon: string }>();
      
      expenseTransactions.forEach((txn) => {
        const categoryId = txn.categoryId || 'uncategorized';
        const categoryInfo = getCategoryInfo(txn.categoryId);
        const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)) || 0;
        const existing = expenseCategoryMap.get(categoryId) || {
          amount: 0,
          name: categoryInfo.name,
          color: categoryInfo.color,
          icon: categoryInfo.icon,
        };
        expenseCategoryMap.set(categoryId, {
          ...existing,
          amount: existing.amount + amount,
        });
      });

      const totalExpenseAmount = Array.from(expenseCategoryMap.values()).reduce(
        (sum, cat) => sum + cat.amount,
        0
      );

      const expenseDist = Array.from(expenseCategoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          amount: data.amount,
          percentage: totalExpenseAmount > 0 ? (data.amount / totalExpenseAmount) * 100 : 0,
          color: data.color,
          icon: data.icon,
        }))
        .sort((a, b) => b.amount - a.amount);

      setExpenseCategories(expenseDist);

      // Income distribution
      const incomeTransactions = allTransactions.filter((t) => t.type === 'INCOME');
      const incomeCategoryMap = new Map<string, { amount: number; name: string; color: string; icon: string }>();
      
      incomeTransactions.forEach((txn) => {
        const categoryId = txn.categoryId || 'uncategorized';
        const categoryInfo = getCategoryInfo(txn.categoryId);
        const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)) || 0;
        const existing = incomeCategoryMap.get(categoryId) || {
          amount: 0,
          name: categoryInfo.name,
          color: categoryInfo.color || '#4CAF50',
          icon: categoryInfo.icon,
        };
        incomeCategoryMap.set(categoryId, {
          ...existing,
          amount: existing.amount + amount,
        });
      });

      const totalIncomeAmount = Array.from(incomeCategoryMap.values()).reduce(
        (sum, cat) => sum + cat.amount,
        0
      );

      const incomeDist = Array.from(incomeCategoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          amount: data.amount,
          percentage: totalIncomeAmount > 0 ? (data.amount / totalIncomeAmount) * 100 : 0,
          color: data.color,
          icon: data.icon,
        }))
        .sort((a, b) => b.amount - a.amount);

      setIncomeCategories(incomeDist);

      // Load monthly comparison (last 6 months)
      const currentDate = new Date();
      const monthlyData: MonthlyData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const monthTransactionsRaw = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: monthStart,
            endDate: monthEnd,
          });
        });

        const monthTransactions: Transaction[] = Array.isArray(monthTransactionsRaw)
          ? monthTransactionsRaw.map((row: any) => mapRowToTransaction(row))
          : [];

        let monthIncome = 0;
        let monthExpense = 0;
        monthTransactions.forEach((txn) => {
          const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)) || 0;
          if (txn.type === 'INCOME') {
            monthIncome += amount;
          } else if (txn.type === 'EXPENSE') {
            monthExpense += amount;
          }
        });

        monthlyData.push({
          period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          income: monthIncome,
          expense: monthExpense,
          balance: monthIncome - monthExpense,
        });
      }
      setMonthlyComparison(monthlyData);

      // Load trend data
      const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : selectedPeriod === 'quarter' ? 90 : 365;
      const trendDataArray: TrendData[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString();

        const dayTransactionsRaw = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: dayStart,
            endDate: dayEnd,
          });
        });

        const dayTransactions: Transaction[] = Array.isArray(dayTransactionsRaw)
          ? dayTransactionsRaw.map((row: any) => mapRowToTransaction(row))
          : [];

        let dayIncome = 0;
        let dayExpense = 0;
        dayTransactions.forEach((txn) => {
          const amount = typeof txn.amount === 'number' ? txn.amount : parseFloat(String(txn.amount)) || 0;
          if (txn.type === 'INCOME') {
            dayIncome += amount;
          } else if (txn.type === 'EXPENSE') {
            dayExpense += amount;
          }
        });

        trendDataArray.push({
          date: dayStart,
          income: dayIncome,
          expense: dayExpense,
        });
      }
      setTrendData(trendDataArray);

    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedCategoryFilter, categories, getDateRange]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, []);

  return {
    loading,
    summary,
    categories,
    transactions,
    expenseCategories,
    incomeCategories,
    monthlyComparison,
    trendData,
    loadData,
    getDateRange,
  };
};

export default useFinancialData;
