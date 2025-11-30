// src/Bieudo.tsx - Báo cáo & Thống kê + Gợi ý Ngân sách & Mục tiêu
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { BudgetAndGoalsOverview } from "./components/budget";
import { BarChart, LineChart, PieChart } from "./components/charts";
import {
  SummaryHeader,
  ChartsScreen,
  StatisticsScreen,
  BudgetScreen,
} from "./components/report";
import { COLLECTIONS } from "./constants/collections";
import { useTheme } from "./context/ThemeContext";
import { auth, db } from "./firebaseConfig";
import { AnalyticsService } from "./service/analytics/AnalyticsService";
import databaseService from "./database/databaseService";
import { Category, Transaction } from "./domain/types";
import { CategoryRepository } from "./database/repositories";
import { mapRowToTransaction } from "./domain/mappers";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

type ChartScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Bieudo"
>;

const { width } = Dimensions.get("window");

const ChartScreen = () => {
  const navigation = useNavigation<ChartScreenNavigationProp>();
  const { themeColor } = useTheme();

  const [activeTab, setActiveTab] = useState<"chart" | "stats" | "budget">(
    "chart"
  );
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "quarter" | "year"
  >("month");
  const [loading, setLoading] = useState(true);

  // Data states
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [balance, setBalance] = useState(0);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [lastMonthsExpenses, setLastMonthsExpenses] = useState<
    { month: string; total: number }[]
  >([]);

  // New states for enhanced features
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    string | null
  >(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePeriod, setComparePeriod] = useState<
    "week" | "month" | "quarter" | "year" | null
  >(null);
  const [compareData, setCompareData] = useState<{
    income: number;
    expense: number;
    balance: number;
  } | null>(null);
  const [largeExpenseAlerts, setLargeExpenseAlerts] = useState<any[]>([]);
  const [showChartDetail, setShowChartDetail] = useState(false);
  const [selectedChartData, setSelectedChartData] = useState<any>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [chartCustomization, setChartCustomization] = useState({
    showLabels: true,
    showLegend: true,
    colorScheme: "default" as "default" | "pastel" | "vibrant",
  });

  // Budget-related states
  const [budgetRule, setBudgetRule] = useState({
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
  });
  const [categoryBudgets, setCategoryBudgets] = useState<any[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);
  const [adjustmentSuggestions, setAdjustmentSuggestions] = useState<any[]>([]);

  // Use ref to store loadData function to avoid infinite loops
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);

  // Calculate date range based on selected period
  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();

    switch (selectedPeriod) {
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        end.setMilliseconds(999);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
        break;
      case "year":
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

  // Load all data
  const loadData = useCallback(async () => {
    // Retry helper function
    const retryDbOperation = async <T extends any>(
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
            (errorMessage.includes("database is locked") ||
              errorMessage.includes("finalizeAsync")) &&
            i < maxRetries - 1
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, delay * (i + 1))
            );
            continue;
          }
          throw error;
        }
      }
      throw new Error("Max retries exceeded");
    };

    // Retry helper for category operations
    const retryCategoryOperation = async <T extends any>(
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
            (errorMessage.includes("database is locked") ||
              errorMessage.includes("finalizeAsync")) &&
            i < maxRetries - 1
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, delay * (i + 1))
            );
            continue;
          }
          throw error;
        }
      }
      throw new Error("Max retries exceeded");
    };

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user?.uid) {
        console.warn("User not authenticated");
        setLoading(false);
        return;
      }

      await retryDbOperation(async () => {
        await databaseService.ensureInitialized();
      });

      // ✅ Load categories: Default from Firebase CATEGORIES_DEFAULT + User from SQLite
      try {
        console.log("📋 Loading combined categories (default + user)...");

        // Use CategoryService to get combined categories (default from Firebase + user from SQLite)
        const CategoryService = (await import("./services/categoryService"))
          .default;
        const combinedCategories = await CategoryService.getCombinedCategories(
          user.uid
        );

        console.log(
          `📋 Loaded ${combinedCategories.length} combined categories`
        );

        if (
          Array.isArray(combinedCategories) &&
          combinedCategories.length > 0
        ) {
          setCategories(combinedCategories as Category[]);
        } else {
          console.warn("⚠️ No categories found, trying fallback...");
          // Fallback: Load from SQLite only
          const cats = await retryCategoryOperation(async () => {
            return await databaseService.getCategoriesByUser(user.uid);
          });
          if (Array.isArray(cats) && cats.length > 0) {
            const mappedCategories: Category[] = cats.map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              name: row.name,
              type: row.type,
              isSystemDefault: !!row.is_system_default,
              icon: row.icon,
              color: row.color,
              parentCategoryId: row.parent_category_id ?? null,
              displayOrder: row.display_order,
              isHidden: !!row.is_hidden,
              createdAt: row.created_at,
            }));
            setCategories(mappedCategories);
          } else {
            // Last fallback: Try CategoryRepository
            const cats = await retryCategoryOperation(async () => {
              return await CategoryRepository.listByUser(user.uid);
            });
            setCategories(cats);
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        console.warn("Failed to load combined categories:", errorMessage);
        // Fallback to CategoryRepository with retry
        try {
          const cats = await retryCategoryOperation(async () => {
            return await CategoryRepository.listByUser(user.uid);
          });
          setCategories(cats);
        } catch (fallbackError: any) {
          const fallbackErrorMessage =
            fallbackError?.message || String(fallbackError);
          if (!fallbackErrorMessage.includes("database is locked")) {
            console.error(
              "Failed to load categories from repository:",
              fallbackError
            );
          }
        }
      }

      const range = getDateRange();

      // ✅ Load all transactions from SQLite directly with retry
      const options: any = {
        startDate: range.start,
        endDate: range.end,
      };
      if (selectedCategoryFilter) {
        options.categoryId = selectedCategoryFilter;
      }

      // Try to load without date filter first to debug
      const allTransactionsRawNoFilter = await retryDbOperation(async () => {
        return await databaseService.getTransactionsByUser(user.uid, {});
      });
      console.log(
        `📊 Total transactions in SQLite (no filter): ${
          allTransactionsRawNoFilter?.length || 0
        }`
      );
      if (allTransactionsRawNoFilter && allTransactionsRawNoFilter.length > 0) {
        console.log(
          `📊 Sample transaction date:`,
          allTransactionsRawNoFilter[0].date
        );
      }

      const allTransactionsRaw = await retryDbOperation(async () => {
        return await databaseService.getTransactionsByUser(user.uid, options);
      });

      // Ensure allTransactionsRaw is an array
      if (!Array.isArray(allTransactionsRaw)) {
        console.warn(
          "getTransactionsByUser returned non-array:",
          allTransactionsRaw
        );
        setLoading(false);
        return;
      }

      // Map database rows to Transaction objects (like Timkiem.tsx)
      const allTransactions: Transaction[] = allTransactionsRaw.map(
        (row: any) => {
          const mapped = mapRowToTransaction(row);
          // ✅ デバッグ: 最初の数件の取引のカテゴリIDを確認
          if (allTransactionsRaw.indexOf(row) < 5) {
            console.log(`📊 Transaction mapping [${allTransactionsRaw.indexOf(row)}]:`, {
              row_category_id: row.category_id,
              row_categoryID: row.categoryID,
              row_category_id_from_join: row.category_id_from_join,
              row_category_name: row.category_name,
              mapped_categoryId: mapped.categoryId,
              row_id: row.id,
              row_type: row.type,
            });
          }
          return mapped;
        }
      );
      
      // ✅ デバッグ: カテゴリIDの統計を確認
      const categoryIdStats = {
        withCategoryId: 0,
        withoutCategoryId: 0,
        uniqueCategoryIds: new Set<string>(),
      };
      allTransactions.forEach((txn) => {
        if (txn.categoryId) {
          categoryIdStats.withCategoryId++;
          categoryIdStats.uniqueCategoryIds.add(String(txn.categoryId));
        } else {
          categoryIdStats.withoutCategoryId++;
        }
      });
      console.log(`📊 Category ID Statistics:`, {
        withCategoryId: categoryIdStats.withCategoryId,
        withoutCategoryId: categoryIdStats.withoutCategoryId,
        uniqueCategoryIds: Array.from(categoryIdStats.uniqueCategoryIds).slice(0, 10),
      });

      console.log(
        `📊 Loaded ${allTransactions.length} transactions from SQLite for period ${selectedPeriod}`
      );
      console.log(`📊 Date range: ${range.start} to ${range.end}`);
      if (allTransactions.length > 0) {
        console.log(`📊 Sample transaction:`, {
          id: allTransactions[0].id,
          amount: allTransactions[0].amount,
          type: allTransactions[0].type,
          date: allTransactions[0].date,
          categoryId: allTransactions[0].categoryId,
        });
      } else {
        console.warn(`⚠️ No transactions found for period ${selectedPeriod}`);
        // If no transactions found with filter, try without date filter to see if there are any transactions
        if (
          allTransactionsRawNoFilter &&
          allTransactionsRawNoFilter.length > 0
        ) {
          console.warn(
            `⚠️ But found ${allTransactionsRawNoFilter.length} transactions without date filter - date range may be incorrect`
          );
        }
      }

      // Calculate totals from mapped Transaction objects
      let income = 0;
      let expense = 0;
      allTransactions.forEach((txn: Transaction) => {
        const amount =
          typeof txn.amount === "number"
            ? txn.amount
            : parseFloat(String(txn.amount)) || 0;
        if (txn.type === "INCOME") {
          income += amount;
        } else if (txn.type === "EXPENSE") {
          expense += amount;
        }
      });

      const totals = { income, expense, balance: income - expense };
      console.log(
        `💰 Calculated totals: Income=${income}, Expense=${expense}, Balance=${totals.balance}`
      );

      setTotalIncome(totals.income);
      setTotalExpense(totals.expense);
      setBalance(totals.balance);

      // Check for large expenses (expenses > 10% of total income or > 1M VND)
      try {
        const expenseTransactionsRaw = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: range.start,
            endDate: range.end,
            type: "EXPENSE",
          });
        });

        // Map to Transaction objects
        const expenseTransactionsMapped: Transaction[] = Array.isArray(
          expenseTransactionsRaw
        )
          ? expenseTransactionsRaw.map((row: any) => mapRowToTransaction(row))
          : [];

        // Get category info helper
        // ✅ 改善: 複数のフィールド名をチェック
        const getCategoryInfoForExpense = (
          categoryId: string | null | undefined
        ) => {
          if (!categoryId) {
            return "Không phân loại";
          }
          const category = categories.find(
            (cat) =>
              cat.id === categoryId ||
              cat.id === String(categoryId) ||
              String(cat.id) === String(categoryId) ||
              (cat as any).categoryID === categoryId ||
              (cat as any).category_id === categoryId
          );
          return category?.name || "Không phân loại";
        };

        const largeExpenses = expenseTransactionsMapped
          .filter((txn: Transaction) => {
            const amount =
              typeof txn.amount === "number"
                ? txn.amount
                : parseFloat(String(txn.amount)) || 0;
            return (
              amount > 1000000 ||
              (totals.income > 0 && amount > totals.income * 0.1)
            );
          })
          .map((txn: Transaction) => ({
            id: txn.id,
            description: txn.description || "Không có mô tả",
            amount:
              typeof txn.amount === "number"
                ? txn.amount
                : parseFloat(String(txn.amount)) || 0,
            date: txn.date,
            categoryId: txn.categoryId,
            categoryName: getCategoryInfoForExpense(txn.categoryId),
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5); // Top 5 largest expenses
        setLargeExpenseAlerts(largeExpenses);
      } catch (error) {
        console.warn("Failed to check large expenses:", error);
      }

      // ✅ Calculate category distributions from mapped Transaction objects
      const expenseTransactions = allTransactions.filter(
        (t: Transaction) => t.type === "EXPENSE"
      );
      const incomeTransactions = allTransactions.filter(
        (t: Transaction) => t.type === "INCOME"
      );

      // Get category info helper function (like Timkiem.tsx)
      // ✅ 改善: 複数のフィールド名をチェックしてカテゴリを検索（同期処理）
      const getCategoryInfo = (categoryId: string | null | undefined, row?: any) => {
        if (!categoryId) {
          return {
            name: "Không phân loại",
            icon: "tag",
            color: "#9E9E9E",
          };
        }
        
        // ✅ 優先1: JOIN結果からカテゴリ情報を取得（既に取得済みの場合）
        if (row && row.category_name) {
          return {
            name: row.category_name || "Không phân loại",
            icon: row.category_icon || "tag",
            color: row.category_color || "#9E9E9E",
          };
        }
        
        // ✅ 優先2: メモリ内のカテゴリリストから検索
        const category = categories.find(
          (cat) =>
            cat.id === categoryId ||
            cat.id === String(categoryId) ||
            String(cat.id) === String(categoryId) ||
            (cat as any).categoryID === categoryId ||
            (cat as any).category_id === categoryId
        );
        
        if (category) {
          return {
            name: category.name || "Không phân loại",
            icon: category.icon || "tag",
            color: category.color || "#9E9E9E",
          };
        }
        
        // カテゴリが見つからない場合
        console.warn(`⚠️ Category not found for ID: ${categoryId}`);
        return {
          name: "Không phân loại",
          icon: "tag",
          color: "#9E9E9E",
        };
      };

      // Calculate expense distribution
      const expenseCategoryMap = new Map<
        string,
        { amount: number; name: string; color: string; icon: string; categoryId: string }
      >();
      
      // ✅ デバッグ: 取引のカテゴリIDを確認
      const categoryIdsInTransactions = new Set<string>();
      const categoryIdMismatches: Array<{ txnId: string; categoryId: string | null; found: boolean }> = [];
      
      expenseTransactions.forEach((txn: Transaction) => {
        const catId = txn.categoryId || (txn as any).category_id || null;
        if (catId) {
          categoryIdsInTransactions.add(String(catId));
          // カテゴリが存在するか確認
          const found = categories.some(
            (c) => c.id === String(catId) || c.id === catId || (c as any).categoryID === catId
          );
          if (!found && categoryIdMismatches.length < 10) {
            categoryIdMismatches.push({
              txnId: txn.id,
              categoryId: String(catId),
              found: false,
            });
          }
        }
      });
      
      console.log(`📊 Found ${categoryIdsInTransactions.size} unique category IDs in expense transactions:`, Array.from(categoryIdsInTransactions).slice(0, 10));
      console.log(`📊 Available categories: ${categories.length}`, categories.slice(0, 10).map((c) => ({ id: c.id, name: c.name, type: c.type })));
      
      if (categoryIdMismatches.length > 0) {
        console.warn(`⚠️ Found ${categoryIdMismatches.length} transactions with category IDs that don't match any category:`, categoryIdMismatches.slice(0, 5));
      }
      
      expenseTransactions.forEach((txn: Transaction) => {
        // ✅ 元のrowデータを取得（JOIN結果を含む）
        const originalRow = allTransactionsRaw.find((row: any) => row.id === txn.id);
        
        // ✅ 複数のフィールド名からcategoryIdを取得
        const categoryId = txn.categoryId || 
                          (txn as any).category_id || 
                          (txn as any).categoryID || 
                          originalRow?.category_id || 
                          originalRow?.transaction_category_id || 
                          "uncategorized";
        
        // ✅ JOIN結果を優先してカテゴリ情報を取得
        const categoryInfo = getCategoryInfo(categoryId, originalRow);
        const amount =
          typeof txn.amount === "number"
            ? txn.amount
            : parseFloat(String(txn.amount)) || 0;
        
        // ✅ カテゴリIDを正規化（文字列に統一）
        const normalizedCategoryId = String(categoryId);
        
        const existing = expenseCategoryMap.get(normalizedCategoryId) || {
          amount: 0,
          name: categoryInfo.name,
          color: categoryInfo.color,
          icon: categoryInfo.icon,
          categoryId: normalizedCategoryId,
        };
        expenseCategoryMap.set(normalizedCategoryId, {
          ...existing,
          amount: existing.amount + amount,
        });
      });

      const totalExpense = Array.from(expenseCategoryMap.values()).reduce(
        (sum, cat) => sum + cat.amount,
        0
      );

      const expenseDist = Array.from(expenseCategoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          amount: data.amount,
          percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
          color: data.color,
          icon: data.icon,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate income distribution
      const incomeCategoryMap = new Map<
        string,
        { amount: number; name: string; color: string; icon: string; categoryId: string }
      >();
      
      // ✅ デバッグ: 収入取引のカテゴリIDを確認
      const incomeCategoryIdsInTransactions = new Set<string>();
      incomeTransactions.forEach((txn: Transaction) => {
        const catId = txn.categoryId || (txn as any).category_id || null;
        if (catId) {
          incomeCategoryIdsInTransactions.add(String(catId));
        }
      });
      console.log(`📊 Found ${incomeCategoryIdsInTransactions.size} unique category IDs in income transactions:`, Array.from(incomeCategoryIdsInTransactions).slice(0, 10));
      
      // ✅ 改善: 収入取引の元データ（row）も保持してJOIN結果を活用
      const incomeTransactionsWithRows = incomeTransactions.map((txn) => {
        const originalRow = allTransactionsRaw.find((row: any) => row.id === txn.id);
        return { txn, row: originalRow };
      });
      
      // カテゴリ情報を取得（同期処理）
      incomeTransactionsWithRows.forEach(({ txn, row }) => {
        // ✅ 複数のフィールド名からcategoryIdを取得
        const categoryId = txn.categoryId || (txn as any).category_id || (txn as any).categoryID || row?.category_id || row?.transaction_category_id || "uncategorized";
        
        // ✅ JOIN結果から直接取得を試みる
        let categoryInfo;
        if (row && row.category_name) {
          categoryInfo = {
            name: row.category_name || "Không phân loại",
            icon: row.category_icon || "tag",
            color: row.category_color || "#4CAF50",
          };
        } else {
          // メモリ内のカテゴリリストから検索
          const category = categories.find(
            (cat) =>
              cat.id === categoryId ||
              cat.id === String(categoryId) ||
              String(cat.id) === String(categoryId)
          );
          categoryInfo = {
            name: category?.name || "Không phân loại",
            icon: category?.icon || "tag",
            color: category?.color || "#4CAF50",
          };
        }
        
        const amount =
          typeof txn.amount === "number"
            ? txn.amount
            : parseFloat(String(txn.amount)) || 0;
        
        // ✅ カテゴリIDを正規化（文字列に統一）
        const normalizedCategoryId = String(categoryId);
        
        const existing = incomeCategoryMap.get(normalizedCategoryId) || {
          amount: 0,
          name: categoryInfo.name,
          color: categoryInfo.color || "#4CAF50",
          icon: categoryInfo.icon,
          categoryId: normalizedCategoryId,
        };
        incomeCategoryMap.set(normalizedCategoryId, {
          ...existing,
          amount: existing.amount + amount,
        });
      });

      const totalIncome = Array.from(incomeCategoryMap.values()).reduce(
        (sum, cat) => sum + cat.amount,
        0
      );

      const incomeDist = Array.from(incomeCategoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          amount: data.amount,
          percentage: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0,
          color: data.color,
          icon: data.icon,
        }))
        .sort((a, b) => b.amount - a.amount);

      console.log(
        `📊 Category distribution: ${expenseDist.length} expense categories, ${incomeDist.length} income categories`
      );

      setExpenseCategories(expenseDist);
      setIncomeCategories(incomeDist);

      // ✅ Calculate monthly comparison from SQLite data (last 6 months)
      const currentDate = new Date();
      const monthlyData: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        const monthStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          1
        ).toISOString();
        const monthEnd = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
          23,
          59,
          59
        ).toISOString();

        const monthTransactionsRaw = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: monthStart,
            endDate: monthEnd,
          });
        });

        // Map to Transaction objects
        const monthTransactions: Transaction[] = Array.isArray(
          monthTransactionsRaw
        )
          ? monthTransactionsRaw.map((row: any) => mapRowToTransaction(row))
          : [];

        let monthIncome = 0;
        let monthExpense = 0;
        monthTransactions.forEach((txn: Transaction) => {
          const amount =
            typeof txn.amount === "number"
              ? txn.amount
              : parseFloat(String(txn.amount)) || 0;
          if (txn.type === "INCOME") {
            monthIncome += amount;
          } else if (txn.type === "EXPENSE") {
            monthExpense += amount;
          }
        });

        monthlyData.push({
          period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}`,
          income: monthIncome,
          expense: monthExpense,
          balance: monthIncome - monthExpense,
        });
      }
      console.log(`📅 Monthly comparison: ${monthlyData.length} months`);
      setMonthlyComparison(monthlyData);

      // ✅ Calculate trend data from SQLite data
      const trendData: any[] = [];
      const daysToShow =
        selectedPeriod === "week"
          ? 7
          : selectedPeriod === "month"
          ? 30
          : selectedPeriod === "quarter"
          ? 90
          : 365;

      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() - i);
        const dayStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).toISOString();
        const dayEnd = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59
        ).toISOString();

        const dayTransactionsRaw = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: dayStart,
            endDate: dayEnd,
          });
        });

        // Map to Transaction objects
        const dayTransactions: Transaction[] = Array.isArray(dayTransactionsRaw)
          ? dayTransactionsRaw.map((row: any) => mapRowToTransaction(row))
          : [];

        let dayIncome = 0;
        let dayExpense = 0;
        dayTransactions.forEach((txn: Transaction) => {
          const amount =
            typeof txn.amount === "number"
              ? txn.amount
              : parseFloat(String(txn.amount)) || 0;
          if (txn.type === "INCOME") {
            dayIncome += amount;
          } else if (txn.type === "EXPENSE") {
            dayExpense += amount;
          }
        });

        trendData.push({
          date: dayStart,
          income: dayIncome,
          expense: dayExpense,
        });
      }
      console.log(`📈 Trend data: ${trendData.length} days`);
      setTrendData(trendData);

      // Load budget alerts
      const monthYear = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;
      const alerts = await AnalyticsService.checkBudgetAlerts(
        user.uid,
        monthYear
      );
      setBudgetAlerts(alerts);

      // Load user info and goals
      try {
        const FirebaseService = (
          await import("./service/firebase/FirebaseService")
        ).default;
        const [userData, goalsData] = await Promise.all([
          FirebaseService.getUser(user.uid),
          FirebaseService.getGoals(user.uid),
        ]);

        if (userData) {
          setMonthlyIncome((userData as any).monthlyIncome || 0);
        }

        if (goalsData && Array.isArray(goalsData)) {
          const mappedGoals = goalsData.map((goal: any) => ({
            id: goal.id || goal.goalID,
            name: goal.name,
            targetAmount: goal.targetAmount || goal.target_amount || 0,
            savedAmount: goal.savedAmount || goal.saved_amount || 0,
            endDate: goal.endDate
              ? new Date(goal.endDate).toISOString()
              : goal.end_date
              ? new Date(goal.end_date).toISOString()
              : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: goal.status || "ACTIVE",
          }));
          setGoals(mappedGoals);
        }

        // ✅ Calculate last months expenses from SQLite for budget recommendation
        const lastMonths: { month: string; total: number }[] = [];
        const currentDateForBudget = new Date();
        for (let i = 5; i >= 0; i--) {
          const date = new Date(
            currentDateForBudget.getFullYear(),
            currentDateForBudget.getMonth() - i,
            1
          );
          const monthStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            1
          ).toISOString();
          const monthEnd = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0,
            23,
            59,
            59
          ).toISOString();

          const monthTransactions = await retryDbOperation(async () => {
            return await databaseService.getTransactionsByUser(user.uid, {
              startDate: monthStart,
              endDate: monthEnd,
              type: "EXPENSE",
            });
          });

          let monthExpense = 0;
          if (Array.isArray(monthTransactions)) {
            monthExpense = monthTransactions.reduce(
              (sum, txn: any) => sum + (parseFloat(txn.amount) || 0),
              0
            );
          }

          lastMonths.push({
            month: `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`,
            total: monthExpense,
          });
        }
        setLastMonthsExpenses(lastMonths);

        // ✅ Load budget rule from user data
        if (userData && (userData as any).budgetRule) {
          const ruleParts = (userData as any).budgetRule.split("-");
          if (ruleParts.length === 3) {
            setBudgetRule({
              needsPercent: parseInt(ruleParts[0]) || 50,
              wantsPercent: parseInt(ruleParts[1]) || 30,
              savingsPercent: parseInt(ruleParts[2]) || 20,
            });
          }
        }

        // ✅ Calculate category budgets from SQLite and Firebase
        try {
          const FirebaseService = (
            await import("./service/firebase/FirebaseService")
          ).default;
          const budgets = await FirebaseService.getBudgets(user.uid);

          const currentMonth = `${currentDateForBudget.getFullYear()}-${String(
            currentDateForBudget.getMonth() + 1
          ).padStart(2, "0")}`;

          // Get current month's category expenses
          const currentMonthTransactions = await retryDbOperation(async () => {
            return await databaseService.getTransactionsByUser(user.uid, {
              startDate: new Date(
                currentDateForBudget.getFullYear(),
                currentDateForBudget.getMonth(),
                1
              ).toISOString(),
              endDate: new Date(
                currentDateForBudget.getFullYear(),
                currentDateForBudget.getMonth() + 1,
                0,
                23,
                59,
                59
              ).toISOString(),
              type: "EXPENSE",
            });
          });

          // Calculate spent amounts by category
          const categorySpentMap = new Map<string, number>();
          if (Array.isArray(currentMonthTransactions)) {
            currentMonthTransactions.forEach((txn: any) => {
              const categoryId = txn.category_id || "uncategorized";
              const amount = parseFloat(txn.amount) || 0;
              const current = categorySpentMap.get(categoryId) || 0;
              categorySpentMap.set(categoryId, current + amount);
            });
          }

          // Map budgets with spent amounts
          const mappedBudgets = budgets
            .filter((b: any) => b.monthYear === currentMonth)
            .map((budget: any) => {
              const category = categories.find(
                (c) => c.id === budget.categoryID
              );
              const spentAmount = categorySpentMap.get(budget.categoryID) || 0;
              const budgetAmount = budget.budgetAmount || 0;
              const percentage =
                budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;

              return {
                categoryId: budget.categoryID,
                categoryName: category?.name || "Không phân loại",
                icon: category?.icon || "tag",
                color: category?.color || "#2196F3",
                budgetAmount,
                spentAmount,
                percentage,
              };
            });

          setCategoryBudgets(mappedBudgets);
        } catch (error) {
          console.warn("Failed to load category budgets:", error);
        }

        // ✅ Calculate spending trends (last 6 months)
        try {
          const trends: any[] = [];
          for (let i = 5; i >= 0; i--) {
            const date = new Date(
              currentDateForBudget.getFullYear(),
              currentDateForBudget.getMonth() - i,
              1
            );
            const monthStart = new Date(
              date.getFullYear(),
              date.getMonth(),
              1
            ).toISOString();
            const monthEnd = new Date(
              date.getFullYear(),
              date.getMonth() + 1,
              0,
              23,
              59,
              59
            ).toISOString();

            const monthTransactions = await retryDbOperation(async () => {
              return await databaseService.getTransactionsByUser(user.uid, {
                startDate: monthStart,
                endDate: monthEnd,
                type: "EXPENSE",
              });
            });

            let monthExpense = 0;
            if (Array.isArray(monthTransactions)) {
              monthExpense = monthTransactions.reduce(
                (sum, txn: any) => sum + (parseFloat(txn.amount) || 0),
                0
              );
            }

            // Calculate change percent compared to previous month
            let changePercent = 0;
            let trend: "up" | "down" | "stable" = "stable";
            if (i > 0 && trends.length > 0) {
              const prevExpense = trends[trends.length - 1].amount;
              if (prevExpense > 0) {
                changePercent =
                  ((monthExpense - prevExpense) / prevExpense) * 100;
                if (changePercent > 5) trend = "up";
                else if (changePercent < -5) trend = "down";
                else trend = "stable";
              }
            }

            trends.push({
              period: `${date.getFullYear()}-${String(
                date.getMonth() + 1
              ).padStart(2, "0")}`,
              amount: monthExpense,
              changePercent,
              trend,
            });
          }
          setSpendingTrends(trends);
        } catch (error) {
          console.warn("Failed to calculate spending trends:", error);
        }

        // ✅ Calculate adjustment suggestions
        try {
          const suggestions: any[] = [];
          const currentMonth = `${currentDateForBudget.getFullYear()}-${String(
            currentDateForBudget.getMonth() + 1
          ).padStart(2, "0")}`;

          // Get current month's expenses by category
          const currentMonthStart = new Date(
            currentDateForBudget.getFullYear(),
            currentDateForBudget.getMonth(),
            1
          ).toISOString();
          const currentMonthEnd = new Date(
            currentDateForBudget.getFullYear(),
            currentDateForBudget.getMonth() + 1,
            0,
            23,
            59,
            59
          ).toISOString();

          const currentMonthTransactions = await retryDbOperation(async () => {
            return await databaseService.getTransactionsByUser(user.uid, {
              startDate: currentMonthStart,
              endDate: currentMonthEnd,
              type: "EXPENSE",
            });
          });

          // Calculate category expenses
          const categoryExpenseMap = new Map<string, number>();
          if (Array.isArray(currentMonthTransactions)) {
            currentMonthTransactions.forEach((txn: any) => {
              const categoryId = txn.category_id || "uncategorized";
              const amount = parseFloat(txn.amount) || 0;
              const current = categoryExpenseMap.get(categoryId) || 0;
              categoryExpenseMap.set(categoryId, current + amount);
            });
          }

          // Get budgets
          const FirebaseService = (
            await import("./service/firebase/FirebaseService")
          ).default;
          const budgets = await FirebaseService.getBudgets(user.uid);
          const currentBudgets = budgets.filter(
            (b: any) => b.monthYear === currentMonth
          );

          // Generate suggestions
          currentBudgets.forEach((budget: any) => {
            const category = categories.find((c) => c.id === budget.categoryID);
            const spentAmount = categoryExpenseMap.get(budget.categoryID) || 0;
            const budgetAmount = budget.budgetAmount || 0;

            if (spentAmount > budgetAmount * 1.1) {
              // Over budget by more than 10%
              suggestions.push({
                type: "reduce",
                category: category?.name || "Không phân loại",
                currentAmount: budgetAmount,
                suggestedAmount: Math.max(
                  spentAmount * 1.05,
                  budgetAmount * 0.9
                ),
                reason: `Chi tiêu hiện tại (${formatCurrency(
                  spentAmount
                )}) vượt quá ngân sách (${formatCurrency(
                  budgetAmount
                )}). Đề xuất tăng ngân sách lên ${formatCurrency(
                  Math.max(spentAmount * 1.05, budgetAmount * 0.9)
                )} để phù hợp với thực tế.`,
                impact: spentAmount > budgetAmount * 1.2 ? "high" : "medium",
              });
            } else if (spentAmount < budgetAmount * 0.7 && budgetAmount > 0) {
              // Under budget by more than 30%
              suggestions.push({
                type: "reduce",
                category: category?.name || "Không phân loại",
                currentAmount: budgetAmount,
                suggestedAmount: Math.max(
                  spentAmount * 1.1,
                  budgetAmount * 0.8
                ),
                reason: `Chi tiêu hiện tại (${formatCurrency(
                  spentAmount
                )}) thấp hơn nhiều so với ngân sách (${formatCurrency(
                  budgetAmount
                )}). Có thể giảm ngân sách để tối ưu hóa.`,
                impact: "low",
              });
            }
          });

          // Check top spending categories without budgets
          const topCategories = Array.from(categoryExpenseMap.entries())
            .map(([categoryId, amount]) => {
              const category = categories.find((c) => c.id === categoryId);
              const hasBudget = currentBudgets.some(
                (b: any) => b.categoryID === categoryId
              );
              return { categoryId, category, amount, hasBudget };
            })
            .filter((item) => !item.hasBudget && item.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3);

          const formatCurrencyLocal = (amt: number): string => {
            if (amt >= 1000000) {
              return `${(amt / 1000000).toFixed(1)}M ₫`;
            }
            return `${(amt / 1000).toFixed(0)}K ₫`;
          };

          topCategories.forEach((item) => {
            const suggestedAmt = item.amount * 1.1;
            suggestions.push({
              type: "increase",
              category: item.category?.name || "Không phân loại",
              currentAmount: 0,
              suggestedAmount: suggestedAmt,
              reason: `Danh mục "${
                item.category?.name
              }" có chi tiêu ${formatCurrencyLocal(
                item.amount
              )} nhưng chưa có ngân sách. Đề xuất thiết lập ngân sách ${formatCurrencyLocal(
                suggestedAmt
              )}.`,
              impact: item.amount > monthlyIncome * 0.1 ? "high" : "medium",
            });
          });

          setAdjustmentSuggestions(suggestions);
        } catch (error) {
          console.warn("Failed to calculate adjustment suggestions:", error);
        }
      } catch (error) {
        console.warn("Failed to load user data or goals:", error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedPeriod, selectedCategoryFilter]);

  // Update loadDataRef whenever loadData changes
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Load compare data when compare mode is enabled
  useEffect(() => {
    const loadCompareData = async () => {
      if (!compareMode || !comparePeriod) {
        setCompareData(null);
        return;
      }

      // Retry helper function
      const retryDbOperation = async <T extends any>(
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
              (errorMessage.includes("database is locked") ||
                errorMessage.includes("finalizeAsync")) &&
              i < maxRetries - 1
            ) {
              await new Promise((resolve) =>
                setTimeout(resolve, delay * (i + 1))
              );
              continue;
            }
            throw error;
          }
        }
        throw new Error("Max retries exceeded");
      };

      try {
        const user = auth.currentUser;
        if (!user?.uid) return;

        const now = new Date();
        let start: Date;
        let end: Date;

        // Calculate previous period
        switch (comparePeriod) {
          case "week":
            start = new Date(now);
            start.setDate(now.getDate() - 14);
            end = new Date(now);
            end.setDate(now.getDate() - 7);
            break;
          case "month":
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
          case "quarter":
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
            end = new Date(now.getFullYear(), quarter * 3, 0, 23, 59, 59);
            break;
          case "year":
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;
          default:
            return;
        }

        // ✅ Calculate compare totals from SQLite with retry
        const compareTransactions = await retryDbOperation(async () => {
          return await databaseService.getTransactionsByUser(user.uid, {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          });
        });

        let compareIncome = 0;
        let compareExpense = 0;
        if (Array.isArray(compareTransactions)) {
          compareTransactions.forEach((txn: any) => {
            const amount = parseFloat(txn.amount) || 0;
            if (txn.type === "INCOME") {
              compareIncome += amount;
            } else if (txn.type === "EXPENSE") {
              compareExpense += amount;
            }
          });
        }

        setCompareData({
          income: compareIncome,
          expense: compareExpense,
          balance: compareIncome - compareExpense,
        });
      } catch (error) {
        console.error("Error loading compare data:", error);
      }
    };

    loadCompareData();
  }, [compareMode, comparePeriod]);

  // Initial load on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]); // Only reload when loadData changes (which happens when selectedPeriod or selectedCategoryFilter changes)

  // ✅ REAL-TIME SYNC: Set up Firebase listeners for data synchronization
  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user?.uid) return;

      let isMounted = true;
      let reloadTimeout: ReturnType<typeof setTimeout> | null = null;
      let lastReloadTime = 0;
      const RELOAD_DEBOUNCE_MS = 2000; // 2 seconds debounce

      // Queue for database operations to prevent concurrent access
      let transactionSyncQueue: Promise<void> = Promise.resolve();
      let categorySyncQueue: Promise<void> = Promise.resolve();
      let isSyncingTransactions = false;
      let isSyncingCategories = false;

      console.log(
        "🔄 Bieudo screen focused, setting up real-time listeners..."
      );

      let unsubscribeTransactions: (() => void) | null = null;
      let unsubscribeCategories: (() => void) | null = null;
      let unsubscribeGoals: (() => void) | null = null;

      // Retry helper function
      const retryDbOperation = async <T extends any>(
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
              (errorMessage.includes("database is locked") ||
                errorMessage.includes("finalizeAsync")) &&
              i < maxRetries - 1
            ) {
              await new Promise((resolve) =>
                setTimeout(resolve, delay * (i + 1))
              );
              continue;
            }
            throw error;
          }
        }
        throw new Error("Max retries exceeded");
      };

      // Retry helper for category operations
      const retryCategoryOperation = async <T extends any>(
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
              (errorMessage.includes("database is locked") ||
                errorMessage.includes("finalizeAsync") ||
                errorMessage.includes("UNIQUE constraint")) &&
              i < maxRetries - 1
            ) {
              await new Promise((resolve) =>
                setTimeout(resolve, delay * (i + 1))
              );
              continue;
            }
            // Suppress UNIQUE constraint errors during retries
            if (
              errorMessage.includes("UNIQUE constraint") &&
              i < maxRetries - 1
            ) {
              continue;
            }
            throw error;
          }
        }
        throw new Error("Max retries exceeded");
      };

      // Debounced reload function - use ref to avoid dependency issues
      const debouncedReload = () => {
        const now = Date.now();
        if (now - lastReloadTime < RELOAD_DEBOUNCE_MS) {
          // Clear existing timeout and set a new one
          if (reloadTimeout) {
            clearTimeout(reloadTimeout);
          }
          reloadTimeout = setTimeout(() => {
            if (isMounted && loadDataRef.current) {
              lastReloadTime = Date.now();
              loadDataRef.current();
            }
          }, RELOAD_DEBOUNCE_MS);
          return;
        }
        lastReloadTime = now;
        if (isMounted && loadDataRef.current) {
          loadDataRef.current();
        }
      };

      // Set up transaction listener with error handling
      // Use simpler query to avoid Firestore internal assertion errors
      try {
        // Try with orderBy first, fallback to simple query if it fails
        let transactionsQuery;
        try {
          transactionsQuery = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where("userID", "==", user.uid),
            where("isDeleted", "==", false),
            orderBy("date", "desc")
          );
        } catch (queryError) {
          // Fallback to query without orderBy
          console.warn("Using fallback query without orderBy:", queryError);
          transactionsQuery = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where("userID", "==", user.uid),
            where("isDeleted", "==", false)
          );
        }

        unsubscribeTransactions = onSnapshot(
          transactionsQuery,
          async (snapshot) => {
            try {
              // Check if snapshot has error metadata
              if (
                snapshot.metadata?.hasPendingWrites === false &&
                snapshot.empty
              ) {
                // Empty snapshot, skip processing
                return;
              }

              console.log(
                `📊 Firebase transactions updated: ${snapshot.docs.length} transactions`
              );

              // Sync Firebase transactions to SQLite with queue and retry
              // Prevent concurrent sync operations
              if (isSyncingTransactions) {
                console.log(
                  "⏳ Transaction sync already in progress, skipping..."
                );
                return;
              }

              // Queue the sync operation
              transactionSyncQueue = transactionSyncQueue.then(async () => {
                isSyncingTransactions = true;
                try {
                  const TransactionRepository = (
                    await import("./database/repositories")
                  ).TransactionRepository;

                  // Batch process transactions to reduce database locks
                  const transactionsToSync = [];
                  for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const now = new Date().toISOString();
                    const createdAt = data.createdAt?.toMillis
                      ? new Date(data.createdAt.toMillis()).toISOString()
                      : data.createdAt || now;
                    const updatedAt = data.updatedAt?.toMillis
                      ? new Date(data.updatedAt.toMillis()).toISOString()
                      : data.updatedAt || data.lastModifiedAt?.toMillis
                      ? new Date(data.lastModifiedAt.toMillis()).toISOString()
                      : data.lastModifiedAt || now;
                    const lastModifiedAt = updatedAt;

                    transactionsToSync.push({
                      id: doc.id,
                      data: {
                        id: doc.id,
                        userId: data.userID || user.uid,
                        categoryId: data.categoryID || null,
                        amount: data.amount || 0,
                        type: data.type || "EXPENSE",
                        date: data.date?.toMillis
                          ? new Date(data.date.toMillis()).toISOString()
                          : data.date || now,
                        description: data.description || null,
                        paymentMethod: data.paymentMethod || null,
                        merchantName: data.merchantName || null,
                        merchantLocation: data.merchantLocation || null,
                        latitude: data.latitude || null,
                        longitude: data.longitude || null,
                        tags: data.tags ? data.tags.split(",") : undefined,
                        isSynced: true,
                        lastModifiedAt: lastModifiedAt, // ✅ Đảm bảo có lastModifiedAt
                        isDeleted: false,
                        createdAt: createdAt,
                      },
                    });
                  }

                  // Process transactions sequentially with retry logic
                  let syncedCount = 0;
                  for (const { id, data: txnData } of transactionsToSync) {
                    try {
                      await retryDbOperation(async () => {
                        const existing = await TransactionRepository.getById(
                          id
                        );
                        if (!existing) {
                          await TransactionRepository.create(txnData);
                          syncedCount++;
                        }
                      });
                    } catch (syncError: any) {
                      const errorMessage =
                        syncError?.message || String(syncError);
                      if (!errorMessage.includes("database is locked")) {
                        console.warn(
                          `Failed to sync transaction ${id}:`,
                          syncError
                        );
                      }
                    }
                    // Small delay between operations to prevent lock
                    await new Promise((resolve) => setTimeout(resolve, 10));
                  }

                  if (syncedCount > 0) {
                    console.log(
                      `✅ Synced ${syncedCount} transactions to SQLite`
                    );
                  }

                  // Reload data after syncing transactions (debounced)
                  // Only reload if there are actual changes
                  if (snapshot.docChanges().length > 0) {
                    debouncedReload();
                  }
                } catch (syncError: any) {
                  const errorMessage = syncError?.message || String(syncError);
                  if (!errorMessage.includes("database is locked")) {
                    console.warn(
                      "Failed to sync transactions to SQLite:",
                      syncError
                    );
                  }
                } finally {
                  isSyncingTransactions = false;
                }
              });
            } catch (error) {
              console.error("Error processing transaction snapshot:", error);
            }
          },
          (error) => {
            console.error("Firebase transactions listener error:", error);
            // Disable listener on critical errors
            if (
              error?.code === "failed-precondition" ||
              error?.message?.includes("INTERNAL ASSERTION")
            ) {
              console.warn(
                "Disabling transaction listener due to Firestore error"
              );
              if (unsubscribeTransactions) {
                try {
                  unsubscribeTransactions();
                  unsubscribeTransactions = null;
                } catch (unsubError) {
                  console.warn("Error unsubscribing on error:", unsubError);
                }
              }
            }
          }
        );
      } catch (error) {
        console.error("Failed to set up transaction listener:", error);
      }

      // Set up categories listener with error handling
      try {
        const categoriesQuery = query(
          collection(db, COLLECTIONS.CATEGORIES),
          where("userID", "==", user.uid),
          where("isHidden", "==", false)
        );

        unsubscribeCategories = onSnapshot(
          categoriesQuery,
          async (snapshot) => {
            try {
              console.log(
                `📋 Firebase categories updated: ${snapshot.docs.length} categories`
              );

              // Sync Firebase categories to SQLite with queue and retry
              // Prevent concurrent sync operations
              if (isSyncingCategories) {
                console.log(
                  "⏳ Category sync already in progress, skipping..."
                );
                return;
              }

              // Queue the sync operation
              categorySyncQueue = categorySyncQueue.then(async () => {
                isSyncingCategories = true;
                try {
                  const databaseServiceModule = await import(
                    "./database/databaseService"
                  );
                  const databaseService =
                    databaseServiceModule.default ||
                    databaseServiceModule.DatabaseService;

                  const CategoryRepository = (
                    await import("./database/repositories")
                  ).CategoryRepository;

                  // Load categories with retry
                  let currentSQLiteCategories = await retryCategoryOperation(
                    async () => await CategoryRepository.listByUser(user.uid)
                  );

                  // Remove duplicates before syncing with retry
                  try {
                    const removedCount = await retryCategoryOperation(
                      async () =>
                        await databaseService.removeDuplicateCategories(
                          user.uid
                        )
                    );
                    if (removedCount > 0) {
                      console.log(
                        `🧹 Removed ${removedCount} duplicate categories`
                      );
                      currentSQLiteCategories = await retryCategoryOperation(
                        async () =>
                          await CategoryRepository.listByUser(user.uid)
                      );
                    }
                  } catch (cleanupError: any) {
                    const errorMessage =
                      cleanupError?.message || String(cleanupError);
                    if (!errorMessage.includes("database is locked")) {
                      console.warn(
                        "Failed to remove duplicates:",
                        cleanupError
                      );
                    }
                  }

                  // Filter duplicates from Firebase
                  const seen = new Set<string>();
                  const uniqueDocs = snapshot.docs.filter((doc) => {
                    const data = doc.data();
                    const key = `${data.userID || user.uid}_${data.name}_${
                      data.type || "EXPENSE"
                    }`;
                    if (seen.has(key)) {
                      return false;
                    }
                    seen.add(key);
                    return true;
                  });

                  // Process categories sequentially with retry logic
                  for (const doc of uniqueDocs) {
                    const data = doc.data();
                    try {
                      // Check by name+type, not just ID
                      const existingByName = await retryCategoryOperation(
                        async () =>
                          await databaseService.categoryExistsByName(
                            data.userID || user.uid,
                            data.name,
                            data.type || "EXPENSE"
                          )
                      );

                      const existsById = currentSQLiteCategories.some(
                        (c) => c.id === doc.id
                      );

                      if (!existingByName && !existsById) {
                        try {
                          await retryCategoryOperation(async () => {
                            await databaseService.createCategory({
                              id: doc.id,
                              user_id: data.userID || user.uid,
                              name: data.name,
                              type: data.type || "EXPENSE",
                              icon: data.icon || "tag",
                              color: data.color || "#2196F3",
                              is_system_default: data.isSystemDefault ? 1 : 0,
                              display_order: data.displayOrder || 0,
                              is_hidden: data.isHidden ? 1 : 0,
                            });
                            await databaseService.markAsSynced(
                              "categories",
                              doc.id
                            );
                          });
                          currentSQLiteCategories.push({
                            id: doc.id,
                            name: data.name,
                            type: data.type || "EXPENSE",
                            icon: data.icon || "tag",
                            color: data.color || "#2196F3",
                          } as any);
                        } catch (createError: any) {
                          const errorMessage =
                            createError?.message || String(createError);
                          if (
                            !errorMessage.includes("UNIQUE constraint") &&
                            !errorMessage.includes("database is locked")
                          ) {
                            console.warn(
                              `Failed to create category ${doc.id}:`,
                              createError
                            );
                          }
                        }
                      }
                    } catch (syncError: any) {
                      const errorMessage =
                        syncError?.message || String(syncError);
                      if (!errorMessage.includes("database is locked")) {
                        console.warn(
                          `Failed to sync category ${doc.id}:`,
                          syncError
                        );
                      }
                    }
                    // Small delay between operations to prevent lock
                    await new Promise((resolve) => setTimeout(resolve, 10));
                  }

                  // Remove duplicates after syncing with retry
                  try {
                    await retryCategoryOperation(
                      async () =>
                        await databaseService.removeDuplicateCategories(
                          user.uid
                        )
                    );
                  } catch (cleanupError: any) {
                    const errorMessage =
                      cleanupError?.message || String(cleanupError);
                    if (!errorMessage.includes("database is locked")) {
                      console.warn(
                        "Failed to remove duplicates after sync:",
                        cleanupError
                      );
                    }
                  }

                  // Reload data after syncing categories (debounced)
                  // Only reload if there are actual changes
                  const changes = snapshot.docChanges();
                  if (changes.length > 0) {
                    debouncedReload();
                  }
                } catch (syncError: any) {
                  const errorMessage = syncError?.message || String(syncError);
                  if (!errorMessage.includes("database is locked")) {
                    console.warn(
                      "Failed to sync categories to SQLite:",
                      syncError
                    );
                  }
                } finally {
                  isSyncingCategories = false;
                }
              });
            } catch (error) {
              console.error("Error processing category snapshot:", error);
            }
          },
          (error) => {
            console.error("Firebase categories listener error:", error);
            // Don't reload data on error to avoid infinite loops
          }
        );
      } catch (error) {
        console.error("Failed to set up category listener:", error);
      }

      // Set up goals listener with error handling
      try {
        // Try with orderBy first, fallback to simple query if it fails
        let goalsQuery;
        try {
          goalsQuery = query(
            collection(db, COLLECTIONS.GOAL),
            where("userID", "==", user.uid),
            orderBy("createdAt", "desc")
          );
        } catch (queryError) {
          // Fallback to query without orderBy
          goalsQuery = query(
            collection(db, COLLECTIONS.GOAL),
            where("userID", "==", user.uid)
          );
        }

        unsubscribeGoals = onSnapshot(
          goalsQuery,
          async (snapshot) => {
            try {
              console.log(
                `🎯 Firebase goals updated: ${snapshot.docs.length} goals`
              );
              // Reload data after goals change (debounced)
              // Only reload if there are actual changes
              const changes = snapshot.docChanges();
              if (changes.length > 0) {
                debouncedReload();
              }
            } catch (error) {
              console.error("Error processing goals snapshot:", error);
            }
          },
          (error) => {
            console.error("Firebase goals listener error:", error);
            // Don't reload data on error to avoid infinite loops
          }
        );
      } catch (error) {
        console.error("Failed to set up goals listener:", error);
      }

      return () => {
        isMounted = false;
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
        }
        if (unsubscribeTransactions) {
          try {
            unsubscribeTransactions();
          } catch (error) {
            console.warn("Error unsubscribing transactions:", error);
          }
        }
        if (unsubscribeCategories) {
          try {
            unsubscribeCategories();
          } catch (error) {
            console.warn("Error unsubscribing categories:", error);
          }
        }
        if (unsubscribeGoals) {
          try {
            unsubscribeGoals();
          } catch (error) {
            console.warn("Error unsubscribing goals:", error);
          }
        }
      };
    }, []) // Empty dependency array - only set up listeners once
  );

  // Format currency helper function
  const formatCurrency = useCallback((amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  }, []);

  const PeriodButton = ({
    period,
    label,
  }: {
    period: "week" | "month" | "quarter" | "year";
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.periodButton,
        selectedPeriod === period && [
          styles.periodButtonActive,
          { backgroundColor: themeColor },
        ],
      ]}
      onPress={() => setSelectedPeriod(period)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.periodButtonText,
          selectedPeriod === period && styles.periodButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Prepare chart data
  const barChartData = {
    labels: monthlyComparison.map((m) => {
      const [year, month] = m.period.split("-");
      return `${month}/${year.slice(2)}`;
    }),
    datasets: [
      {
        data: monthlyComparison.map((m) => m.expense / 1000), // Convert to K
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
      },
      {
        data: monthlyComparison.map((m) => m.income / 1000),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
      },
    ],
  };

  const lineChartData = {
    labels: trendData.slice(-7).map((t) => {
      const date = new Date(t.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }),
    datasets: [
      {
        data: trendData.slice(-7).map((t) => t.expense / 1000),
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: trendData.slice(-7).map((t) => t.income / 1000),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const pieChartExpenseData = expenseCategories.map((cat) => ({
    name: cat.categoryName,
    amount: cat.amount,
    color: cat.color || "#FF6B6B",
  }));

  const pieChartIncomeData = incomeCategories.map((cat) => ({
    name: cat.categoryName,
    amount: cat.amount,
    color: cat.color || "#4CAF50",
  }));

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={themeColor} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>
            {new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <View style={styles.statusIcons}>
            <Icon name="volume-variant-off" size={16} color="#fff" />
            <Icon
              name="signal-cellular-3"
              size={16}
              color="#fff"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.statusBattery}>100%</Text>
            <Icon
              name="battery"
              size={18}
              color="#fff"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>

        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Báo cáo & Thống kê</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => setShowExportModal(true)}
              activeOpacity={0.8}
            >
              <Icon name="download" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => setShowShareModal(true)}
              activeOpacity={0.8}
            >
              <Icon name="share-variant" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
              <Icon name="dots-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Summary Header - Compact */}
      <SummaryHeader
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        balance={balance}
        formatCurrency={formatCurrency}
      />

      {/* Period Filter & Actions */}
      <View style={styles.periodSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScroll}
        >
          <PeriodButton period="week" label="Tuần" />
          <PeriodButton period="month" label="Tháng" />
          <PeriodButton period="quarter" label="Quý" />
          <PeriodButton period="year" label="Năm" />
        </ScrollView>
        <View style={styles.periodActions}>
          <TouchableOpacity
            style={[
              styles.periodActionButton,
              compareMode && { backgroundColor: themeColor + "20" },
            ]}
            onPress={() => {
              if (compareMode) {
                setCompareMode(false);
                setComparePeriod(null);
              } else {
                setCompareMode(true);
                setComparePeriod(selectedPeriod);
              }
            }}
          >
            <Icon
              name={compareMode ? "compare" : "compare-horizontal"}
              size={18}
              color={compareMode ? themeColor : "#666"}
            />
            <Text
              style={[
                styles.periodActionText,
                compareMode && { color: themeColor },
              ]}
            >
              So sánh
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.periodActionButton}
            onPress={() => setShowCategoryFilter(true)}
          >
            <Icon name="filter" size={18} color="#666" />
            <Text style={styles.periodActionText}>
              {selectedCategoryFilter ? "Đã lọc" : "Lọc"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Compare Data Display */}
      {compareMode && compareData && (
        <View style={styles.compareSection}>
          <Text style={styles.compareTitle}>So sánh với kỳ trước</Text>
          <View style={styles.compareCards}>
            <View style={styles.compareCard}>
              <Text style={styles.compareLabel}>Thu nhập</Text>
              <Text style={styles.compareValue}>
                {formatCurrency(compareData.income)}
              </Text>
              <Text
                style={[
                  styles.compareChange,
                  {
                    color:
                      totalIncome > compareData.income ? "#4CAF50" : "#F44336",
                  },
                ]}
              >
                {totalIncome > compareData.income ? "↑" : "↓"}{" "}
                {Math.abs(
                  ((totalIncome - compareData.income) / compareData.income) *
                    100
                ).toFixed(1)}
                %
              </Text>
            </View>
            <View style={styles.compareCard}>
              <Text style={styles.compareLabel}>Chi tiêu</Text>
              <Text style={styles.compareValue}>
                {formatCurrency(compareData.expense)}
              </Text>
              <Text
                style={[
                  styles.compareChange,
                  {
                    color:
                      totalExpense < compareData.expense
                        ? "#4CAF50"
                        : "#F44336",
                  },
                ]}
              >
                {totalExpense < compareData.expense ? "↓" : "↑"}{" "}
                {Math.abs(
                  ((totalExpense - compareData.expense) / compareData.expense) *
                    100
                ).toFixed(1)}
                %
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Large Expense Alerts */}
      {largeExpenseAlerts.length > 0 && (
        <View style={styles.alertSection}>
          <View style={styles.alertHeader}>
            <Icon name="alert-circle" size={20} color="#FF9800" />
            <Text style={styles.alertTitle}>Cảnh báo chi tiêu lớn</Text>
          </View>
          {largeExpenseAlerts.map((alert, index) => (
            <View key={index} style={styles.alertItem}>
              <View style={styles.alertItemLeft}>
                <Text style={styles.alertItemName}>{alert.description}</Text>
                <Text style={styles.alertItemCategory}>
                  {alert.categoryName}
                </Text>
              </View>
              <Text style={styles.alertItemAmount}>
                {formatCurrency(alert.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "chart" && [
              styles.activeTab,
              { borderBottomColor: themeColor },
            ],
          ]}
          onPress={() => setActiveTab("chart")}
          activeOpacity={0.7}
        >
          <Icon
            name="chart-donut"
            size={22}
            color={activeTab === "chart" ? themeColor : "#9E9E9E"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "chart" && [
                styles.activeTabText,
                { color: themeColor },
              ],
            ]}
          >
            Biểu đồ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "stats" && [
              styles.activeTab,
              { borderBottomColor: themeColor },
            ],
          ]}
          onPress={() => setActiveTab("stats")}
          activeOpacity={0.7}
        >
          <Icon
            name="chart-bar"
            size={22}
            color={activeTab === "stats" ? themeColor : "#9E9E9E"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "stats" && [
                styles.activeTabText,
                { color: themeColor },
              ],
            ]}
          >
            Thống kê
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "budget" && [
              styles.activeTab,
              { borderBottomColor: themeColor },
            ],
          ]}
          onPress={() => setActiveTab("budget")}
          activeOpacity={0.7}
        >
          <Icon
            name="lightbulb-on"
            size={22}
            color={activeTab === "budget" ? themeColor : "#9E9E9E"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "budget" && [
                styles.activeTabText,
                { color: themeColor },
              ],
            ]}
          >
            Ngân sách
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content - Render screens based on active tab */}
      <View style={styles.content}>
        {activeTab === "chart" && (
          <ChartsScreen
            pieChartExpenseData={pieChartExpenseData}
            pieChartIncomeData={pieChartIncomeData}
            barChartData={barChartData}
            lineChartData={lineChartData}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            themeColor={themeColor}
          />
        )}

        {activeTab === "stats" && (
          <StatisticsScreen
            expenseCategories={expenseCategories}
            monthlyComparison={monthlyComparison}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === "budget" && (
          <BudgetScreen
            monthlyIncome={monthlyIncome}
            lastMonthsExpenses={lastMonthsExpenses}
            categories={categories}
            budgetAlerts={budgetAlerts}
            goals={goals}
            categoryBudgets={categoryBudgets}
            spendingTrends={spendingTrends}
            adjustmentSuggestions={adjustmentSuggestions}
            budgetRule={budgetRule}
            themeColor={themeColor}
            onReloadData={() => {
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }}
            formatCurrency={formatCurrency}
          />
        )}
      </View>

      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lọc theo danh mục</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryFilter(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TouchableOpacity
                style={[
                  styles.categoryFilterItem,
                  !selectedCategoryFilter && styles.categoryFilterItemActive,
                ]}
                onPress={() => {
                  setSelectedCategoryFilter(null);
                  setShowCategoryFilter(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryFilterText,
                    !selectedCategoryFilter && styles.categoryFilterTextActive,
                  ]}
                >
                  Tất cả danh mục
                </Text>
                {!selectedCategoryFilter && (
                  <Icon name="check" size={20} color={themeColor} />
                )}
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryFilterItem,
                    selectedCategoryFilter === cat.id &&
                      styles.categoryFilterItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategoryFilter(cat.id);
                    setShowCategoryFilter(false);
                  }}
                >
                  <View style={styles.categoryFilterLeft}>
                    <View
                      style={[
                        styles.categoryFilterIcon,
                        { backgroundColor: cat.color + "20" },
                      ]}
                    >
                      <Icon
                        name={cat.icon || "tag"}
                        size={20}
                        color={cat.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryFilterText,
                        selectedCategoryFilter === cat.id &&
                          styles.categoryFilterTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </View>
                  {selectedCategoryFilter === cat.id && (
                    <Icon name="check" size={20} color={themeColor} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xuất dữ liệu</Text>
              <TouchableOpacity
                onPress={() => setShowExportModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={async () => {
                  try {
                    const user = auth.currentUser;
                    if (!user?.uid) return;

                    const range = getDateRange();
                    const transactions =
                      await databaseService.getTransactionsByUser(user.uid, {
                        startDate: range.start,
                        endDate: range.end,
                      });

                    // Create CSV content
                    const csvHeader = "Ngày,Loại,Danh mục,Số tiền,Mô tả\n";
                    const csvRows = transactions
                      .map((txn: any) => {
                        const categoryName =
                          categories.find((c) => c.id === txn.category_id)
                            ?.name || "Không phân loại";
                        return `${txn.date},${txn.type},${categoryName},${
                          txn.amount
                        },${txn.description || ""}`;
                      })
                      .join("\n");
                    const csvContent = csvHeader + csvRows;

                    // Save to file
                    const fileName = `baocao_${selectedPeriod}_${
                      new Date().toISOString().split("T")[0]
                    }.csv`;
                    const documentDir = (FileSystem as any).documentDirectory;
                    const fileUri = documentDir + fileName;
                    await FileSystem.writeAsStringAsync(fileUri, csvContent);

                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(fileUri);
                    } else {
                      Alert.alert("Thành công", `Đã lưu file: ${fileName}`);
                    }

                    setShowExportModal(false);
                  } catch (error) {
                    console.error("Error exporting data:", error);
                    Alert.alert("Lỗi", "Không thể xuất dữ liệu");
                  }
                }}
              >
                <Icon name="file-excel" size={24} color="#4CAF50" />
                <Text style={styles.exportOptionText}>Xuất CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={async () => {
                  try {
                    const user = auth.currentUser;
                    if (!user?.uid) return;

                    const range = getDateRange();
                    const transactions =
                      await databaseService.getTransactionsByUser(user.uid, {
                        startDate: range.start,
                        endDate: range.end,
                      });

                    // Create JSON content
                    const jsonData = {
                      period: selectedPeriod,
                      dateRange: range,
                      summary: {
                        totalIncome,
                        totalExpense,
                        balance,
                      },
                      transactions: transactions.map((txn: any) => ({
                        date: txn.date,
                        type: txn.type,
                        category:
                          categories.find((c) => c.id === txn.category_id)
                            ?.name || "Không phân loại",
                        amount: txn.amount,
                        description: txn.description,
                      })),
                    };

                    const jsonContent = JSON.stringify(jsonData, null, 2);
                    const fileName = `baocao_${selectedPeriod}_${
                      new Date().toISOString().split("T")[0]
                    }.json`;
                    const documentDir = (FileSystem as any).documentDirectory;
                    const fileUri = documentDir + fileName;
                    await FileSystem.writeAsStringAsync(fileUri, jsonContent);

                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(fileUri);
                    } else {
                      Alert.alert("Thành công", `Đã lưu file: ${fileName}`);
                    }

                    setShowExportModal(false);
                  } catch (error) {
                    console.error("Error exporting data:", error);
                    Alert.alert("Lỗi", "Không thể xuất dữ liệu");
                  }
                }}
              >
                <Icon name="code-json" size={24} color={themeColor} />
                <Text style={styles.exportOptionText}>Xuất JSON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chia sẻ báo cáo</Text>
              <TouchableOpacity
                onPress={() => setShowShareModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={async () => {
                  try {
                    const reportText = `Báo cáo tài chính ${selectedPeriod}:
Tổng thu nhập: ${formatCurrency(totalIncome)}
Tổng chi tiêu: ${formatCurrency(totalExpense)}
Số dư: ${formatCurrency(balance)}`;

                    await Share.share({
                      message: reportText,
                      title: "Báo cáo tài chính",
                    });
                    setShowShareModal(false);
                  } catch (error) {
                    console.error("Error sharing:", error);
                  }
                }}
              >
                <Icon name="share-variant" size={24} color={themeColor} />
                <Text style={styles.shareOptionText}>Chia sẻ văn bản</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chart Detail Modal */}
      <Modal
        visible={showChartDetail}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChartDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết biểu đồ</Text>
              <TouchableOpacity
                onPress={() => setShowChartDetail(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedChartData && (
                <View>
                  <Text style={styles.chartDetailTitle}>
                    {selectedChartData.title}
                  </Text>
                  {selectedChartData.data && (
                    <View style={styles.chartDetailData}>
                      {selectedChartData.data.map(
                        (item: any, index: number) => (
                          <View key={index} style={styles.chartDetailItem}>
                            <View
                              style={[
                                styles.chartDetailColor,
                                { backgroundColor: item.color || "#FF6B6B" },
                              ]}
                            />
                            <Text style={styles.chartDetailLabel}>
                              {item.name || item.label}
                            </Text>
                            <Text style={styles.chartDetailValue}>
                              {formatCurrency(item.amount || item.value || 0)}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#757575",
  },
  header: {
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statusTime: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBattery: {
    color: "#fff",
    fontSize: 13,
    marginLeft: 6,
    fontWeight: "500",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  summarySection: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: "#fff",
  },
  summaryCard: {
    flex: 1,
    minWidth: "47%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardWide: {
    minWidth: "100%",
  },
  summaryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#757575",
    marginBottom: 4,
    fontWeight: "500",
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  periodSection: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  periodScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
  },
  periodButtonActive: {},
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#757575",
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    color: "#9E9E9E",
    fontWeight: "500",
  },
  activeTabText: {
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 8,
  },
  statItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 2,
  },
  statPercentage: {
    fontSize: 12,
    color: "#757575",
  },
  statAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#424242",
  },
  monthSummaryItem: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 12,
  },
  monthDetails: {
    gap: 8,
  },
  monthDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthDetailLabel: {
    fontSize: 14,
    color: "#757575",
  },
  monthDetailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  periodActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  periodActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    gap: 6,
  },
  periodActionText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  compareSection: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  compareTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 12,
  },
  compareCards: {
    flexDirection: "row",
    gap: 12,
  },
  compareCard: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    padding: 12,
    borderRadius: 12,
  },
  compareLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  compareValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 4,
  },
  compareChange: {
    fontSize: 12,
    fontWeight: "600",
  },
  alertSection: {
    backgroundColor: "#FFF3E0",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  alertItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE0B2",
  },
  alertItemLeft: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#212121",
    marginBottom: 2,
  },
  alertItemCategory: {
    fontSize: 12,
    color: "#757575",
  },
  alertItemAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F44336",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  categoryFilterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    marginBottom: 8,
  },
  categoryFilterItemActive: {
    backgroundColor: "rgba(33, 150, 243, 0.1)",
  },
  categoryFilterLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryFilterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryFilterText: {
    fontSize: 14,
    color: "#212121",
  },
  categoryFilterTextActive: {
    color: "#2196F3",
    fontWeight: "600",
  },
  exportOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  exportOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#212121",
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    gap: 12,
  },
  shareOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#212121",
  },
  chartDetailTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 16,
  },
  chartDetailData: {
    gap: 12,
  },
  chartDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    gap: 12,
  },
  chartDetailColor: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chartDetailLabel: {
    flex: 1,
    fontSize: 14,
    color: "#212121",
  },
  chartDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
  },
  budgetRuleContainer: {
    padding: 16,
  },
  budgetRuleDescription: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 20,
    lineHeight: 20,
  },
  budgetRuleItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
  },
  budgetRuleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  budgetRuleItemLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  budgetRuleInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  budgetRuleInput: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    paddingVertical: 12,
  },
  budgetRulePercent: {
    fontSize: 16,
    color: "#757575",
    marginLeft: 8,
  },
  budgetRuleAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#424242",
  },
  budgetRuleTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginBottom: 20,
  },
  budgetRuleTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  budgetRuleTotalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  budgetRuleSaveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  budgetRuleSaveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  categoryBudgetList: {
    padding: 16,
  },
  categoryBudgetListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 16,
  },
  categoryBudgetListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryBudgetListIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryBudgetListText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#212121",
  },
});

export default ChartScreen;
