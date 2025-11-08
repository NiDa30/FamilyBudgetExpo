// HomeScreen.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category, RootStackParamList } from "../App";
// DÙNG THEME
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { COLLECTIONS } from "./constants/collections";
import { useTheme } from "./context/ThemeContext";
import { CategoryRepository } from "./database/repositories";
import { auth, db } from "./firebaseConfig";
import { TransactionService } from "./service/transactions";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Trangchu"
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  // DI CHUYỂN LÊN ĐẦU – TRƯỚC useState
  const { themeColor } = useTheme();

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    loadCategories();
    refreshTotals();
  }, []);

  useEffect(() => {
    // Recalculate when month changes
    refreshTotals();
  }, [date]);

  // ✅ REAL-TIME SYNC: Reload data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user?.uid) return;

      console.log("🔄 Trangchu screen focused, reloading data...");
      loadCategories();
      refreshTotals();

      // Setup Firebase real-time listeners
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).toISOString();
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1
      ).toISOString();

      // Listen to transactions changes
      const transactionsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where("userID", "==", user.uid),
        where("isDeleted", "==", false)
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
                // Check if transaction exists in SQLite
                const existing = await TransactionRepository.getById(doc.id);

                if (!existing) {
                  // Save new transaction to SQLite
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
                  console.log(`✅ Synced transaction ${doc.id} to SQLite`);
                }
              } catch (syncError) {
                console.warn(
                  `Failed to sync transaction ${doc.id}:`,
                  syncError
                );
              }
            }
          } catch (syncError) {
            console.warn("Failed to sync transactions to SQLite:", syncError);
          }

          // Refresh totals when transactions change
          await refreshTotals();
        },
        (error) => {
          console.error("Firebase transactions listener error:", error);
        }
      );

      // Listen to categories changes
      const categoriesQuery = query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userID", "==", user.uid),
        where("isHidden", "==", false)
      );

      // Debounce timer for category sync
      let categorySyncTimeout: ReturnType<typeof setTimeout> | null = null;
      let lastCategorySyncTime = 0;
      const CATEGORY_SYNC_DEBOUNCE_MS = 2000; // 2 seconds debounce

      const unsubscribeCategories = onSnapshot(
        categoriesQuery,
        async (snapshot) => {
          // Check if there are actual changes
          const changes = snapshot.docChanges();
          if (changes.length === 0) {
            return; // No changes, skip sync
          }

          const now = Date.now();
          // Debounce: skip if synced too recently
          if (now - lastCategorySyncTime < CATEGORY_SYNC_DEBOUNCE_MS) {
            // Clear existing timeout and set a new one
            if (categorySyncTimeout) {
              clearTimeout(categorySyncTimeout);
            }
            categorySyncTimeout = setTimeout(async () => {
              await handleCategorySync(snapshot, user.uid);
              lastCategorySyncTime = Date.now();
            }, CATEGORY_SYNC_DEBOUNCE_MS);
            return;
          }

          lastCategorySyncTime = now;
          await handleCategorySync(snapshot, user.uid);
        },
        (error) => {
          console.error("Firebase categories listener error:", error);
        }
      );

      // Helper function to handle category sync
      const handleCategorySync = async (snapshot: any, uid: string) => {
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
            uid
          );

          // Remove duplicates before syncing
          try {
            const removedCount =
              await databaseService.removeDuplicateCategories(uid);
            if (removedCount > 0) {
              console.log(
                `🧹 Removed ${removedCount} duplicate categories before sync`
              );
              currentSQLiteCategories = await CategoryRepository.listByUser(
                uid
              );
            }
          } catch (cleanupError) {
            console.warn("Failed to remove duplicates:", cleanupError);
          }

          // Filter duplicates from Firebase data
          const seen = new Set<string>();
          const uniqueDocs = snapshot.docs.filter((doc: any) => {
            const data = doc.data();
            const key = `${data.userID || uid}_${data.name}_${
              data.type || "EXPENSE"
            }`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });

          if (uniqueDocs.length !== snapshot.docs.length) {
            console.log(
              `🔄 Filtered ${
                snapshot.docs.length - uniqueDocs.length
              } duplicate categories from Firebase`
            );
          }

          // Batch sync categories to reduce logs
          let syncedCount = 0;
          let updatedCount = 0;
          let skippedCount = 0;

          for (const doc of uniqueDocs) {
            const data = doc.data();
            try {
              // Check if category exists by name+type (not just ID)
              const existingByName = await databaseService.categoryExistsByName(
                data.userID || uid,
                data.name,
                data.type || "EXPENSE"
              );

              const existsById = currentSQLiteCategories.some(
                (c) => c.id === doc.id
              );

              if (!existingByName && !existsById) {
                // Save new category to SQLite using INSERT OR REPLACE to avoid UNIQUE constraint errors
                try {
                  await databaseService.createCategory({
                    id: doc.id,
                    user_id: data.userID || uid,
                    name: data.name,
                    type: data.type || "EXPENSE",
                    icon: data.icon || "tag",
                    color: data.color || "#2196F3",
                    is_system_default: data.isSystemDefault ? 1 : 0,
                    display_order: data.displayOrder || 0,
                    is_hidden: data.isHidden ? 1 : 0,
                  });
                  await databaseService.markAsSynced("categories", doc.id);

                  // ✅ UPDATE STATE: Add to currentSQLiteCategories to prevent duplicate syncs
                  currentSQLiteCategories.push({
                    id: doc.id,
                    name: data.name,
                    type: data.type || "EXPENSE",
                    icon: data.icon || "tag",
                    color: data.color || "#2196F3",
                  } as any);

                  syncedCount++;
                } catch (createError: any) {
                  // If UNIQUE constraint error, try to update instead
                  if (createError?.message?.includes("UNIQUE constraint")) {
                    try {
                      await databaseService.updateCategory(doc.id, {
                        name: data.name,
                        type: data.type || "EXPENSE",
                        icon: data.icon || "tag",
                        color: data.color || "#2196F3",
                        is_system_default: data.isSystemDefault ? 1 : 0,
                        display_order: data.displayOrder || 0,
                        is_hidden: data.isHidden ? 1 : 0,
                      });
                      await databaseService.markAsSynced("categories", doc.id);

                      // ✅ UPDATE STATE: Add to currentSQLiteCategories to prevent duplicate syncs
                      const alreadyExists = currentSQLiteCategories.some(
                        (c) => c.id === doc.id
                      );
                      if (!alreadyExists) {
                        currentSQLiteCategories.push({
                          id: doc.id,
                          name: data.name,
                          type: data.type || "EXPENSE",
                          icon: data.icon || "tag",
                          color: data.color || "#2196F3",
                        } as any);
                      }

                      updatedCount++;
                    } catch (updateError) {
                      // Suppress duplicate error logs
                    }
                  }
                }
              } else {
                skippedCount++;
              }
            } catch (syncError) {
              // Suppress duplicate error logs for UNIQUE constraint errors
              const errorMessage =
                syncError instanceof Error
                  ? syncError.message
                  : String(syncError);
              if (!errorMessage.includes("UNIQUE constraint")) {
                console.warn(`Failed to sync category ${doc.id}:`, syncError);
              }
            }
          }

          // Remove duplicates after syncing
          try {
            const removedCount =
              await databaseService.removeDuplicateCategories(uid);
            if (removedCount > 0) {
              console.log(
                `🧹 Removed ${removedCount} duplicate categories after sync`
              );
            }
          } catch (cleanupError) {
            console.warn(
              "Failed to remove duplicates after sync:",
              cleanupError
            );
          }

          // Log batch sync results only if there were changes
          if (syncedCount > 0 || updatedCount > 0) {
            console.log(
              `📋 Categories synced: ${syncedCount} new, ${updatedCount} updated, ${skippedCount} skipped`
            );
          }
        } catch (syncError) {
          console.warn("Failed to sync categories to SQLite:", syncError);
        }

        // Reload categories when they change
        await loadCategories();
      };

      return () => {
        if (categorySyncTimeout) {
          clearTimeout(categorySyncTimeout);
        }
        unsubscribeTransactions();
        unsubscribeCategories();
      };
    }, [date])
  );

  const loadCategories = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      // ✅ ENSURE CATEGORIES ARE INITIALIZED
      try {
        const databaseServiceModule = await import(
          "./database/databaseService"
        );
        const { ensureCategoriesInitialized } = databaseServiceModule;

        if (
          ensureCategoriesInitialized &&
          typeof ensureCategoriesInitialized === "function"
        ) {
          await ensureCategoriesInitialized(user.uid);
        } else {
          console.warn(
            "ensureCategoriesInitialized is not available, trying alternative import"
          );
          const databaseService =
            databaseServiceModule.default ||
            databaseServiceModule.DatabaseService;
          if (
            databaseService &&
            typeof databaseService.ensureInitialized === "function"
          ) {
            await databaseService.ensureInitialized();
          }
        }
      } catch (initError) {
        console.warn("Failed to ensure categories initialized:", initError);
      }

      // ✅ LOAD FROM SQLITE OR FIREBASE (FALLBACK)
      try {
        const sqliteCategories = await CategoryRepository.listByUser(user.uid);

        if (sqliteCategories && sqliteCategories.length > 0) {
          // Filter by type
          const expense = sqliteCategories
            .filter((cat) => (cat.type || "EXPENSE") === "EXPENSE")
            .map((cat) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0, // Add count property for Category type compatibility
            }));
          const income = sqliteCategories
            .filter((cat) => (cat.type || "INCOME") === "INCOME")
            .map((cat) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0, // Add count property for Category type compatibility
            }));

          setExpenseCategories(expense);
          setIncomeCategories(income);

          // Save to AsyncStorage for quick access
          await AsyncStorage.setItem(
            "expenseCategories",
            JSON.stringify(expense)
          );
          await AsyncStorage.setItem(
            "incomeCategories",
            JSON.stringify(income)
          );

          console.log(
            `✅ Loaded ${expense.length} expense & ${income.length} income categories from SQLite`
          );
          return;
        }
      } catch (sqliteError) {
        console.warn("Failed to load from SQLite:", sqliteError);
      }

      // ✅ FALLBACK TO FIREBASE
      try {
        const FirebaseService = (
          await import("./service/firebase/FirebaseService")
        ).default;
        const firebaseCategories = await FirebaseService.getCategories(
          user.uid
        );

        if (firebaseCategories && firebaseCategories.length > 0) {
          const mappedCategories: any[] = firebaseCategories.map(
            (cat: any) => ({
              id: cat.id || cat.categoryID,
              userId: cat.userID || user.uid,
              name: cat.name,
              type: cat.type || "EXPENSE",
              icon: cat.icon,
              color: cat.color,
              isSystemDefault: cat.isSystemDefault || false,
              displayOrder: cat.displayOrder || 0,
              isHidden: cat.isHidden || false,
              createdAt: cat.createdAt
                ? new Date(cat.createdAt).toISOString()
                : new Date().toISOString(),
            })
          );

          const expense = mappedCategories
            .filter((cat: any) => cat.type === "EXPENSE")
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0, // Add count property for Category type compatibility
            }));
          const income = mappedCategories
            .filter((cat: any) => cat.type === "INCOME")
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0, // Add count property for Category type compatibility
            }));

          setExpenseCategories(expense);
          setIncomeCategories(income);

          // Save to AsyncStorage
          await AsyncStorage.setItem(
            "expenseCategories",
            JSON.stringify(expense)
          );
          await AsyncStorage.setItem(
            "incomeCategories",
            JSON.stringify(income)
          );

          console.log(
            `✅ Loaded ${expense.length} expense & ${income.length} income categories from Firebase`
          );
          return;
        }
      } catch (firebaseError) {
        console.warn("Failed to load from Firebase:", firebaseError);
      }

      // ✅ FALLBACK TO ASYNCSTORAGE
      const storedExpense = await AsyncStorage.getItem("expenseCategories");
      const storedIncome = await AsyncStorage.getItem("incomeCategories");

      if (storedExpense) {
        setExpenseCategories(JSON.parse(storedExpense));
      }
      if (storedIncome) {
        setIncomeCategories(JSON.parse(storedIncome));
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const refreshTotals = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).toISOString();
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1
      ).toISOString();

      // ✅ LOAD FROM SQLITE FIRST (FAST)
      let expenses: any[] = [];
      let incomes: any[] = [];

      try {
        const [sqliteExpenses, sqliteIncomes] = await Promise.all([
          TransactionService.query(user.uid, {
            range: { start, end },
            type: "EXPENSE",
          }),
          TransactionService.query(user.uid, {
            range: { start, end },
            type: "INCOME",
          }),
        ]);

        expenses = sqliteExpenses || [];
        incomes = sqliteIncomes || [];

        console.log(
          `📊 Loaded ${expenses.length} expenses & ${incomes.length} incomes from SQLite`
        );
      } catch (sqliteError) {
        console.warn("Failed to load from SQLite:", sqliteError);
      }

      // ✅ FALLBACK TO FIREBASE IF SQLITE IS EMPTY
      if (
        (expenses.length === 0 && incomes.length === 0) ||
        expenses.length === 0 ||
        incomes.length === 0
      ) {
        try {
          const FirebaseService = (
            await import("./service/firebase/FirebaseService")
          ).default;
          const firebaseTransactions = await FirebaseService.getTransactions(
            user.uid,
            {
              startDate: new Date(start).getTime(),
              endDate: new Date(end).getTime(),
            }
          );

          if (firebaseTransactions && firebaseTransactions.length > 0) {
            const firebaseExpenses = firebaseTransactions.filter(
              (t: any) => t.type === "EXPENSE"
            );
            const firebaseIncomes = firebaseTransactions.filter(
              (t: any) => t.type === "INCOME"
            );

            // Use Firebase data if SQLite is empty
            if (expenses.length === 0) expenses = firebaseExpenses;
            if (incomes.length === 0) incomes = firebaseIncomes;

            console.log(
              `📊 Loaded ${firebaseExpenses.length} expenses & ${firebaseIncomes.length} incomes from Firebase`
            );
          }
        } catch (firebaseError) {
          console.warn("Failed to load from Firebase:", firebaseError);
        }
      }

      const expense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
      const income = incomes.reduce((s, t) => s + (t.amount || 0), 0);

      setTotalExpense(expense);
      setTotalIncome(income);
      setTotalBalance(income - expense);

      console.log(
        `💰 Updated totals: Expense=${expense}, Income=${income}, Balance=${
          income - expense
        }`
      );
    } catch (error) {
      console.error("Error calculating totals:", error);
    }
  };

  const onChangeDate = (_event: any, selectedDate?: Date | undefined) => {
    const currentDate = selectedDate || date;
    setShowPicker(false);
    setDate(currentDate);
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN").format(amount);
  };

  const formatTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getBudgetStatus = () => {
    return "Số dư";
  };

  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;

  const handleCategorySelect = (category: Category) => {
    setShowCategoryModal(false);
    navigation.navigate("Nhap", {
      selectedCategory: category,
      transactionType: activeTab,
    });
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
        <Icon name={item.icon} size={26} color="#fff" />
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
      <Icon
        name="chevron-right"
        size={20}
        color="#BDBDBD"
        style={styles.categoryArrow}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.blueHeader, { backgroundColor: themeColor }]}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>{formatTime()}</Text>
          <View style={styles.statusIcons}>
            <Icon name="volume-variant-off" size={16} color="#fff" />
            <Icon
              name="signal-cellular-3"
              size={16}
              color="#fff"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.statusBattery}>59%</Text>
            <Icon
              name="battery-70"
              size={18}
              color="#fff"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>

        {/* Date and menu */}
        <View style={styles.dateHeader}>
          <TouchableOpacity
            style={styles.dateLeft}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.calendarIconWrapper}>
              <Icon name="calendar-month" size={22} color="#fff" />
            </View>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{getBudgetStatus()}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Setting")}
            style={styles.menuButton}
            activeOpacity={0.8}
          >
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Budget display */}
        <View style={styles.budgetContainer}>
          <Text style={styles.budgetLabel}>Tổng số dư</Text>
          <View style={styles.budgetAmountWrapper}>
            <Text style={styles.currencySymbol}>₫</Text>
            <Text style={styles.budgetAmount}>
              {formatCurrency(totalBalance)}
            </Text>
          </View>
        </View>

        {/* Expense and Income Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrapper}>
              <Icon name="arrow-up" size={20} color="#FF5252" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Chi tiêu</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(totalExpense)} ₫
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { marginLeft: 12 }]}>
            <View
              style={[
                styles.summaryIconWrapper,
                { backgroundColor: "rgba(76, 175, 80, 0.15)" },
              ]}
            >
              <Icon name="arrow-down" size={20} color="#4CAF50" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Thu nhập</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(totalIncome)} ₫
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* White section with shadow */}
      <View style={styles.whiteSection}>
        <View style={styles.budgetSettingHeader}>
          <Text style={styles.budgetSettingTitle}>Ngân sách tháng này</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.budgetSettingLink}>Cài đặt</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.budgetBar}>
          <View
            style={[
              styles.budgetBarFill,
              {
                width:
                  totalExpense > 0
                    ? `${Math.min(
                        (totalExpense / (totalIncome || 1)) * 100,
                        100
                      )}%`
                    : "0%",
              },
            ]}
          />
        </View>
        <Text style={styles.budgetBarText}>
          {totalExpense > 0
            ? `Đã chi ${Math.round((totalExpense / (totalIncome || 1)) * 100)}%`
            : "Chưa có dữ liệu"}
        </Text>
      </View>

      {/* Empty state with better design */}
      <ScrollView
        style={styles.emptyContainer}
        contentContainerStyle={styles.emptyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyIllustration}>
          <Icon
            name="close"
            size={20}
            color="#90CAF9"
            style={styles.decorIcon1}
          />
          <Icon
            name="circle-outline"
            size={14}
            color="#E3F2FD"
            style={styles.decorIcon2}
          />
          <Icon
            name="close"
            size={14}
            color="#E3F2FD"
            style={styles.decorIcon3}
          />
          <Icon
            name="circle-outline"
            size={18}
            color="#90CAF9"
            style={styles.decorIcon4}
          />
          <Icon
            name="close"
            size={18}
            color="#E3F2FD"
            style={styles.decorIcon5}
          />
          <Icon
            name="circle-outline"
            size={12}
            color="#90CAF9"
            style={styles.decorIcon6}
          />

          <View style={styles.scrollIcon}>
            <View style={styles.scrollPaper}>
              <View style={styles.scrollLine} />
              <View style={styles.scrollLine} />
              <View style={styles.scrollLine} />
              <View style={[styles.scrollLine, { width: "60%" }]} />
            </View>
            <View style={styles.scrollBottom} />
          </View>

          <View style={styles.decorDots}>
            <View style={[styles.decorDot, { opacity: 0.3 }]} />
            <View style={[styles.decorDot, { opacity: 0.5 }]} />
            <View style={styles.decorDot} />
            <View style={[styles.decorDot, { opacity: 0.5 }]} />
            <View style={[styles.decorDot, { opacity: 0.3 }]} />
          </View>
        </View>
        <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
        <Text style={styles.emptySubtext}>
          Nhấn nút + để thêm giao dịch mới
        </Text>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      )}

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Timkiem")}
          activeOpacity={0.7}
        >
          <Icon name="text-box-search-outline" size={26} color="#9E9E9E" />
          <Text style={styles.navLabel}>Tìm Kiếm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Home")}
          activeOpacity={0.7}
        >
          <Icon name="view-grid-outline" size={26} color="#2196F3" />
          <Text
            style={[styles.navLabel, { color: "#2196F3", fontWeight: "600" }]}
          >
            Tổng Quan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Bieudo")}
          activeOpacity={0.7}
        >
          <Icon name="chart-pie" size={26} color="#9E9E9E" />
          <Text style={styles.navLabel}>Thống Kê</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Quethoadon")}
        >
          <Icon name="qrcode-scan" size={26} color="#9E9E9E" />
          <Text style={styles.navLabel}>Quét hóa đơn</Text>
        </TouchableOpacity>

        {/* FAB button – DÙNG MÀU THEME */}
        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: themeColor, shadowColor: themeColor },
          ]}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.9}
        >
          <Icon name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.tabsWrapper}>
                <TouchableOpacity
                  style={[
                    styles.modalTab,
                    activeTab === "expense" && styles.modalTabActiveExpense,
                  ]}
                  onPress={() => setActiveTab("expense")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.tabIconWrapper,
                      activeTab === "expense" &&
                        styles.tabIconWrapperActiveExpense,
                    ]}
                  >
                    <Icon
                      name="arrow-up-circle"
                      size={24}
                      color={activeTab === "expense" ? "#fff" : "#F44336"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalTabText,
                      activeTab === "expense" &&
                        styles.modalTabTextActiveExpense,
                    ]}
                  >
                    Chi tiêu
                  </Text>
                </TouchableOpacity>

                <View style={styles.tabDivider} />

                <TouchableOpacity
                  style={[
                    styles.modalTab,
                    activeTab === "income" && styles.modalTabActiveIncome,
                  ]}
                  onPress={() => setActiveTab("income")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.tabIconWrapper,
                      activeTab === "income" &&
                        styles.tabIconWrapperActiveIncome,
                    ]}
                  >
                    <Icon
                      name="arrow-down-circle"
                      size={24}
                      color={activeTab === "income" ? "#fff" : "#4CAF50"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalTabText,
                      activeTab === "income" && styles.modalTabTextActiveIncome,
                    ]}
                  >
                    Thu nhập
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate("Home")}
                style={styles.modalSettingsButton}
                activeOpacity={0.7}
              >
                <Icon name="cog-outline" size={24} color="#757575" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={currentCategories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              numColumns={1}
              contentContainerStyle={styles.categoryList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  blueHeader: {
    // ĐÃ XÓA backgroundColor: '#1E88E5'
    paddingTop: 10,
    paddingBottom: 20,
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
    paddingVertical: 6,
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
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  dateLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  statusBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  budgetContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  budgetLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "500",
  },
  budgetAmountWrapper: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "400",
    marginRight: 4,
  },
  budgetAmount: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: -1,
  },
  summaryContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    padding: 12,
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  summaryLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    marginBottom: 2,
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  whiteSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: -10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  budgetSettingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetSettingTitle: {
    fontSize: 16,
    color: "#212121",
    fontWeight: "600",
  },
  budgetSettingLink: {
    fontSize: 14,
    color: "#1E88E5",
    fontWeight: "500",
  },
  budgetBar: {
    height: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 5,
    overflow: "hidden",
  },
  budgetBarFill: {
    height: "100%",
    width: "0%",
    backgroundColor: "#42A5F5",
  },
  budgetBarText: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIllustration: {
    width: 240,
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 24,
  },
  decorIcon1: {
    position: "absolute",
    top: 10,
    left: 20,
    opacity: 0.6,
  },
  decorIcon2: {
    position: "absolute",
    top: 20,
    right: 30,
    opacity: 0.4,
  },
  decorIcon3: {
    position: "absolute",
    bottom: 60,
    left: 15,
    opacity: 0.3,
  },
  decorIcon4: {
    position: "absolute",
    top: 50,
    right: 15,
    opacity: 0.5,
  },
  decorIcon5: {
    position: "absolute",
    bottom: 50,
    right: 25,
    opacity: 0.3,
  },
  decorIcon6: {
    position: "absolute",
    top: 80,
    left: 30,
    opacity: 0.4,
  },
  scrollIcon: {
    alignItems: "center",
  },
  scrollPaper: {
    width: 120,
    height: 150,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#90CAF9",
    padding: 16,
    justifyContent: "flex-start",
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  scrollLine: {
    width: "100%",
    height: 4,
    backgroundColor: "#BBDEFB",
    marginVertical: 6,
    borderRadius: 2,
  },
  scrollBottom: {
    width: 100,
    height: 35,
    backgroundColor: "#90CAF9",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginTop: -12,
  },
  decorDots: {
    flexDirection: "row",
    marginTop: 20,
  },
  decorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#90CAF9",
    marginHorizontal: 4,
  },
  emptyText: {
    fontSize: 18,
    color: "#424242",
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 11,
    color: "#9E9E9E",
    marginTop: 4,
    fontWeight: "500",
  },
  addButton: {
    // ĐÃ XÓA backgroundColor: '#1E88E5'
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: "absolute",
    right: 20,
    bottom: 70,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  tabsWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    padding: 4,
    marginRight: 12,
  },
  modalTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalTabActiveExpense: {
    backgroundColor: "#F44336",
    shadowColor: "#F44336",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTabActiveIncome: {
    backgroundColor: "#4CAF50",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconWrapperActiveExpense: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabIconWrapperActiveIncome: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabDivider: {
    width: 8,
  },
  modalTabText: {
    fontSize: 14,
    color: "#757575",
    fontWeight: "600",
  },
  modalTabTextActiveExpense: {
    color: "#fff",
    fontWeight: "700",
  },
  modalTabTextActiveIncome: {
    color: "#fff",
    fontWeight: "700",
  },
  modalSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryList: {
    padding: 20,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    color: "#212121",
    fontWeight: "500",
  },
  categoryArrow: {
    marginLeft: 8,
  },
  emptyCategoryContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCategoryText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 16,
    marginBottom: 24,
  },
  addCategoryButton: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addCategoryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default HomeScreen;
