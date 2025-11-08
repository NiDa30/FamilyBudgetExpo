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
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import {
  BudgetAlerts,
  BudgetRecommendation,
  GoalTracker,
} from "./components/budget";
import { BarChart, LineChart, PieChart } from "./components/charts";
import { COLLECTIONS } from "./constants/collections";
import { useTheme } from "./context/ThemeContext";
import { auth, db } from "./firebaseConfig";
import { AnalyticsService } from "./service/analytics/AnalyticsService";

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
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
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
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user?.uid) {
        console.warn("User not authenticated");
        setLoading(false);
        return;
      }

      const range = getDateRange();

      // Load totals
      const totals = await AnalyticsService.getTotals(user.uid, range);
      setTotalIncome(totals.income);
      setTotalExpense(totals.expense);
      setBalance(totals.balance);

      // Load category distributions
      const [expenseDist, incomeDist] = await Promise.all([
        AnalyticsService.getCategoryDistribution(user.uid, range, "EXPENSE"),
        AnalyticsService.getCategoryDistribution(user.uid, range, "INCOME"),
      ]);

      setExpenseCategories(expenseDist);
      setIncomeCategories(incomeDist);

      // Load monthly comparison (for bar chart)
      const monthlyData = await AnalyticsService.getMonthlyComparison(
        user.uid,
        6
      );
      setMonthlyComparison(monthlyData);

      // Load trend data (for line chart)
      const trend = await AnalyticsService.getTrendData(
        user.uid,
        selectedPeriod
      );
      setTrendData(trend);

      // Load budget alerts
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(
        now.getMonth() + 1
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

        // Calculate last months expenses for budget recommendation
        const lastMonths: { month: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0,
            23,
            59,
            59
          );
          const monthTotals = await AnalyticsService.getTotals(user.uid, {
            start: monthStart.toISOString(),
            end: monthEnd.toISOString(),
          });
          lastMonths.push({
            month: `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`,
            total: monthTotals.expense,
          });
        }
        setLastMonthsExpenses(lastMonths);
      } catch (error) {
        console.warn("Failed to load user data or goals:", error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ✅ REAL-TIME SYNC: Set up Firebase listeners for data synchronization
  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user?.uid) return;

      console.log(
        "🔄 Bieudo screen focused, setting up real-time listeners..."
      );

      // Set up transaction listener
      const transactionsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where("userID", "==", user.uid),
        where("isDeleted", "==", false),
        orderBy("date", "desc")
      );

      const unsubscribeTransactions = onSnapshot(
        transactionsQuery,
        async (snapshot) => {
          console.log(
            `📊 Firebase transactions updated: ${snapshot.docs.length} transactions`
          );

          // Sync Firebase transactions to SQLite
          try {
            const TransactionRepository = (
              await import("./database/repositories")
            ).TransactionRepository;

            for (const doc of snapshot.docs) {
              const data = doc.data();
              try {
                const existing = await TransactionRepository.getById(doc.id);
                if (!existing) {
                  await TransactionRepository.create({
                    id: doc.id,
                    userId: data.userID || user.uid,
                    categoryId: data.categoryID || null,
                    amount: data.amount || 0,
                    type: data.type || "EXPENSE",
                    date: data.date?.toMillis
                      ? new Date(data.date.toMillis()).toISOString()
                      : data.date || new Date().toISOString(),
                    description: data.description || null,
                    paymentMethod: data.paymentMethod || null,
                    merchantName: data.merchantName || null,
                    merchantLocation: data.merchantLocation || null,
                    latitude: data.latitude || null,
                    longitude: data.longitude || null,
                    tags: data.tags ? data.tags.split(",") : undefined,
                    isSynced: true,
                    lastModifiedAt: data.updatedAt?.toMillis
                      ? new Date(data.updatedAt.toMillis()).toISOString()
                      : new Date().toISOString(),
                    isDeleted: false,
                    createdAt: data.createdAt?.toMillis
                      ? new Date(data.createdAt.toMillis()).toISOString()
                      : new Date().toISOString(),
                  });
                }
              } catch (syncError) {
                // Suppress duplicate error logs
              }
            }

            // Reload data after syncing transactions
            loadData();
          } catch (syncError) {
            console.warn("Failed to sync transactions to SQLite:", syncError);
          }
        },
        (error) => {
          console.error("Firebase transactions listener error:", error);
        }
      );

      // Set up categories listener
      const categoriesQuery = query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userID", "==", user.uid),
        where("isHidden", "==", false)
      );

      const unsubscribeCategories = onSnapshot(
        categoriesQuery,
        async (snapshot) => {
          console.log(
            `📋 Firebase categories updated: ${snapshot.docs.length} categories`
          );

          // Sync Firebase categories to SQLite
          try {
            const databaseServiceModule = await import(
              "./database/databaseService"
            );
            const databaseService =
              databaseServiceModule.default ||
              databaseServiceModule.DatabaseService;

            const CategoryRepository = (await import("./database/repositories"))
              .CategoryRepository;
            let currentSQLiteCategories = await CategoryRepository.listByUser(
              user.uid
            );

            // Remove duplicates before syncing
            try {
              const removedCount = await databaseService.removeDuplicateCategories(user.uid);
              if (removedCount > 0) {
                console.log(`🧹 Removed ${removedCount} duplicate categories`);
                currentSQLiteCategories = await CategoryRepository.listByUser(user.uid);
              }
            } catch (cleanupError) {
              console.warn("Failed to remove duplicates:", cleanupError);
            }

            // Filter duplicates from Firebase
            const seen = new Set<string>();
            const uniqueDocs = snapshot.docs.filter((doc) => {
              const data = doc.data();
              const key = `${data.userID || user.uid}_${data.name}_${data.type || "EXPENSE"}`;
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });

            for (const doc of uniqueDocs) {
              const data = doc.data();
              try {
                // Check by name+type, not just ID
                const existingByName = await databaseService.categoryExistsByName(
                  data.userID || user.uid,
                  data.name,
                  data.type || "EXPENSE"
                );
                
                const existsById = currentSQLiteCategories.some(
                  (c) => c.id === doc.id
                );

                if (!existingByName && !existsById) {
                  try {
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
                    await databaseService.markAsSynced("categories", doc.id);
                    currentSQLiteCategories.push({
                      id: doc.id,
                      name: data.name,
                      type: data.type || "EXPENSE",
                      icon: data.icon || "tag",
                      color: data.color || "#2196F3",
                    } as any);
                  } catch (createError: any) {
                    if (createError?.message?.includes("UNIQUE constraint")) {
                      // Category already exists, skip
                    }
                  }
                }
              } catch (syncError) {
                // Suppress duplicate error logs
              }
            }
            
            // Remove duplicates after syncing
            try {
              await databaseService.removeDuplicateCategories(user.uid);
            } catch (cleanupError) {
              console.warn("Failed to remove duplicates after sync:", cleanupError);
            }

            // Reload data after syncing categories
            loadData();
          } catch (syncError) {
            console.warn("Failed to sync categories to SQLite:", syncError);
          }
        },
        (error) => {
          console.error("Firebase categories listener error:", error);
        }
      );

      // Set up goals listener
      const goalsQuery = query(
        collection(db, COLLECTIONS.GOAL),
        where("userID", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribeGoals = onSnapshot(
        goalsQuery,
        async (snapshot) => {
          console.log(
            `🎯 Firebase goals updated: ${snapshot.docs.length} goals`
          );
          // Reload data after goals change
          loadData();
        },
        (error) => {
          console.error("Firebase goals listener error:", error);
        }
      );

      return () => {
        unsubscribeTransactions();
        unsubscribeCategories();
        unsubscribeGoals();
      };
    }, [loadData])
  );

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

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
          <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrapper}>
            <Icon name="arrow-up" size={24} color="#F44336" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Tổng chi tiêu</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalExpense)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIconWrapper,
              { backgroundColor: "rgba(76, 175, 80, 0.15)" },
            ]}
          >
            <Icon name="arrow-down" size={24} color="#4CAF50" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Tổng thu nhập</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardWide]}>
          <View
            style={[
              styles.summaryIconWrapper,
              {
                backgroundColor:
                  balance >= 0
                    ? "rgba(33, 150, 243, 0.15)"
                    : "rgba(244, 67, 54, 0.15)",
              },
            ]}
          >
            <Icon
              name="wallet"
              size={24}
              color={balance >= 0 ? "#1E88E5" : "#F44336"}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Số dư</Text>
            <Text
              style={[
                styles.summaryAmount,
                { color: balance >= 0 ? "#1E88E5" : "#F44336" },
              ]}
            >
              {balance >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(balance))}
            </Text>
          </View>
        </View>
      </View>

      {/* Period Filter */}
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
      </View>

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

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "chart" && (
          <>
            {/* Pie Charts */}
            <PieChart
              data={pieChartExpenseData}
              title="Phân loại Chi tiêu"
              total={totalExpense}
            />
            <PieChart
              data={pieChartIncomeData}
              title="Phân loại Thu nhập"
              total={totalIncome}
            />

            {/* Bar Chart - Monthly Comparison */}
            <BarChart
              data={barChartData}
              title="So sánh Thu nhập & Chi tiêu theo Tháng"
              yAxisLabel=""
              yAxisSuffix="K ₫"
              themeColor={themeColor}
            />

            {/* Line Chart - Trend */}
            <LineChart
              data={lineChartData}
              title="Xu hướng Thu nhập & Chi tiêu"
              yAxisLabel=""
              yAxisSuffix="K ₫"
              themeColor={themeColor}
            />
          </>
        )}

        {activeTab === "stats" && (
          <>
            {/* Category Statistics */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>
                Thống kê Chi tiêu theo Danh mục
              </Text>
              {expenseCategories.length > 0 ? (
                expenseCategories.map((cat, index) => (
                  <View key={index} style={styles.statItem}>
                    <View style={styles.statItemLeft}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: cat.color || "#FF6B6B" },
                        ]}
                      >
                        <Icon name={cat.icon || "tag"} size={20} color="#fff" />
                      </View>
                      <View style={styles.statInfo}>
                        <Text style={styles.statName}>{cat.categoryName}</Text>
                        <Text style={styles.statPercentage}>
                          {cat.percentage.toFixed(1)}% tổng chi tiêu
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.statAmount}>
                      {formatCurrency(cat.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="chart-bar" size={48} color="#E0E0E0" />
                  <Text style={styles.emptyStateText}>Chưa có dữ liệu</Text>
                </View>
              )}
            </View>

            {/* Monthly Summary */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Tóm tắt theo Tháng</Text>
              {monthlyComparison.length > 0 ? (
                monthlyComparison.map((month, index) => (
                  <View key={index} style={styles.monthSummaryItem}>
                    <Text style={styles.monthLabel}>{month.period}</Text>
                    <View style={styles.monthDetails}>
                      <View style={styles.monthDetailRow}>
                        <Text style={styles.monthDetailLabel}>Thu nhập:</Text>
                        <Text
                          style={[
                            styles.monthDetailValue,
                            { color: "#4CAF50" },
                          ]}
                        >
                          {formatCurrency(month.income)}
                        </Text>
                      </View>
                      <View style={styles.monthDetailRow}>
                        <Text style={styles.monthDetailLabel}>Chi tiêu:</Text>
                        <Text
                          style={[
                            styles.monthDetailValue,
                            { color: "#F44336" },
                          ]}
                        >
                          {formatCurrency(month.expense)}
                        </Text>
                      </View>
                      <View style={styles.monthDetailRow}>
                        <Text style={styles.monthDetailLabel}>Số dư:</Text>
                        <Text
                          style={[
                            styles.monthDetailValue,
                            {
                              color: month.balance >= 0 ? "#1E88E5" : "#F44336",
                            },
                          ]}
                        >
                          {month.balance >= 0 ? "+" : ""}
                          {formatCurrency(Math.abs(month.balance))}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="calendar" size={48} color="#E0E0E0" />
                  <Text style={styles.emptyStateText}>Chưa có dữ liệu</Text>
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === "budget" && (
          <>
            {/* Budget Recommendation */}
            <BudgetRecommendation
              monthlyIncome={monthlyIncome}
              lastMonthsExpenses={lastMonthsExpenses}
              themeColor={themeColor}
            />

            {/* Budget Alerts */}
            {budgetAlerts.length > 0 && (
              <BudgetAlerts alerts={budgetAlerts} themeColor={themeColor} />
            )}

            {/* Goal Tracker */}
            <GoalTracker
              goals={goals}
              themeColor={themeColor}
              onAddGoalPress={() => {
                // TODO: Navigate to goal creation screen
                console.log("Navigate to goal creation");
              }}
            />
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
});

export default ChartScreen;
