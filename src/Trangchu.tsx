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

      // Database operation queue to prevent concurrent access
      let transactionSyncQueue: Promise<void> = Promise.resolve();
      let isSyncingTransactions = false;

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
              errorMessage.includes("database is locked") ||
              errorMessage.includes("finalizeAsync")
            ) {
              if (i < maxRetries - 1) {
                await new Promise((resolve) =>
                  setTimeout(resolve, delay * (i + 1))
                );
                continue;
              }
            }
            throw error;
          }
        }
        throw new Error("Max retries exceeded");
      };

      const unsubscribeTransactions = onSnapshot(
        transactionsQuery,
        async (snapshot) => {
          console.log(
            `📊 Firebase transactions updated: ${snapshot.docs.length} transactions`
          );

          // Prevent concurrent sync operations
          if (isSyncingTransactions) {
            console.log("⏳ Transaction sync already in progress, skipping...");
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
                  },
                });
              }

              // Process transactions sequentially with retry logic
              let syncedCount = 0;
              for (const { id, data: txnData } of transactionsToSync) {
                try {
                  await retryDbOperation(async () => {
                    const existing = await TransactionRepository.getById(id);
                    if (!existing) {
                      await TransactionRepository.create(txnData);
                      syncedCount++;
                    }
                  });
                } catch (syncError: any) {
                  const errorMessage = syncError?.message || String(syncError);
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
                console.log(`✅ Synced ${syncedCount} transactions to SQLite`);
              }

              // Refresh totals when transactions change
              await retryDbOperation(() => refreshTotals());
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
      let categorySyncQueue: Promise<void> = Promise.resolve();
      let isSyncingCategories = false;

      // Retry helper function for categories
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
              errorMessage.includes("database is locked") ||
              errorMessage.includes("finalizeAsync")
            ) {
              if (i < maxRetries - 1) {
                await new Promise((resolve) =>
                  setTimeout(resolve, delay * (i + 1))
                );
                continue;
              }
            }
            throw error;
          }
        }
        throw new Error("Max retries exceeded");
      };

      const unsubscribeCategories = onSnapshot(
        categoriesQuery,
        async (snapshot) => {
          // Check if there are actual changes
          const changes = snapshot.docChanges();
          if (changes.length === 0) {
            return; // No changes, skip sync
          }

          // Prevent concurrent sync operations
          if (isSyncingCategories) {
            console.log("⏳ Category sync already in progress, skipping...");
            return;
          }

          const now = Date.now();
          // Debounce: skip if synced too recently
          if (now - lastCategorySyncTime < CATEGORY_SYNC_DEBOUNCE_MS) {
            // Clear existing timeout and set a new one
            if (categorySyncTimeout) {
              clearTimeout(categorySyncTimeout);
            }
            categorySyncTimeout = setTimeout(async () => {
              categorySyncQueue = categorySyncQueue.then(async () => {
                isSyncingCategories = true;
                try {
                  await retryCategoryOperation(() =>
                    handleCategorySync(snapshot, user.uid)
                  );
                  lastCategorySyncTime = Date.now();
                } finally {
                  isSyncingCategories = false;
                }
              });
            }, CATEGORY_SYNC_DEBOUNCE_MS);
            return;
          }

          lastCategorySyncTime = now;
          categorySyncQueue = categorySyncQueue.then(async () => {
            isSyncingCategories = true;
            try {
              await retryCategoryOperation(() =>
                handleCategorySync(snapshot, user.uid)
              );
            } finally {
              isSyncingCategories = false;
            }
          });
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

          // Retry database operations
          let currentSQLiteCategories = await retryCategoryOperation(() =>
            CategoryRepository.listByUser(uid)
          );

          // Remove duplicates before syncing
          try {
            const removedCount = await retryCategoryOperation(() =>
              databaseService.removeDuplicateCategories(uid)
            );
            if (removedCount > 0) {
              console.log(
                `🧹 Removed ${removedCount} duplicate categories before sync`
              );
              currentSQLiteCategories = await retryCategoryOperation(() =>
                CategoryRepository.listByUser(uid)
              );
            }
          } catch (cleanupError: any) {
            const errorMessage = cleanupError?.message || String(cleanupError);
            if (!errorMessage.includes("database is locked")) {
              console.warn("Failed to remove duplicates:", cleanupError);
            }
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
              // Check if category exists by name+type (not just ID) with retry
              const existingByName = await retryCategoryOperation(() =>
                databaseService.categoryExistsByName(
                  data.userID || uid,
                  data.name,
                  data.type || "EXPENSE"
                )
              );

              const existsById = currentSQLiteCategories.some(
                (c) => c.id === doc.id
              );

              if (!existingByName && !existsById) {
                // Save new category to SQLite using INSERT OR REPLACE to avoid UNIQUE constraint errors
                try {
                  await retryCategoryOperation(async () => {
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
                  });

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
                  const errorMessage =
                    createError?.message || String(createError);
                  if (errorMessage.includes("UNIQUE constraint")) {
                    try {
                      await retryCategoryOperation(async () => {
                        await databaseService.updateCategory(doc.id, {
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
                    } catch (updateError: any) {
                      // Suppress duplicate error logs and database lock errors
                      const updateErrorMessage =
                        updateError?.message || String(updateError);
                      if (
                        !updateErrorMessage.includes("UNIQUE constraint") &&
                        !updateErrorMessage.includes("database is locked")
                      ) {
                        console.warn(
                          `Failed to update category ${doc.id}:`,
                          updateError
                        );
                      }
                    }
                  } else if (!errorMessage.includes("database is locked")) {
                    console.warn(
                      `Failed to create category ${doc.id}:`,
                      createError
                    );
                  }
                }
              } else {
                skippedCount++;
              }
            } catch (syncError: any) {
              // Suppress duplicate error logs for UNIQUE constraint and database lock errors
              const errorMessage =
                syncError instanceof Error
                  ? syncError.message
                  : String(syncError);
              if (
                !errorMessage.includes("UNIQUE constraint") &&
                !errorMessage.includes("database is locked")
              ) {
                console.warn(`Failed to sync category ${doc.id}:`, syncError);
              }
            }
            // Small delay between operations to prevent lock
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          // Remove duplicates after syncing
          try {
            const removedCount = await retryCategoryOperation(() =>
              databaseService.removeDuplicateCategories(uid)
            );
            if (removedCount > 0) {
              console.log(
                `🧹 Removed ${removedCount} duplicate categories after sync`
              );
            }
          } catch (cleanupError: any) {
            const errorMessage = cleanupError?.message || String(cleanupError);
            if (!errorMessage.includes("database is locked")) {
              console.warn(
                "Failed to remove duplicates after sync:",
                cleanupError
              );
            }
          }

          // Log batch sync results only if there were changes
          if (syncedCount > 0 || updatedCount > 0) {
            console.log(
              `📋 Categories synced: ${syncedCount} new, ${updatedCount} updated, ${skippedCount} skipped`
            );
          }
        } catch (syncError: any) {
          const errorMessage = syncError?.message || String(syncError);
          if (!errorMessage.includes("database is locked")) {
            console.warn("Failed to sync categories to SQLite:", syncError);
          }
        }

        // Reload categories when they change with retry
        try {
          await retryCategoryOperation(() => loadCategories());
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          if (!errorMessage.includes("database is locked")) {
            console.warn("Failed to reload categories:", error);
          }
        }
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
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryType}>
          {activeTab === "expense" ? "Chi tiêu" : "Thu nhập"}
        </Text>
      </View>
      <View style={styles.categoryAction}>
        <Icon
          name="chevron-right"
          size={24}
          color="#BDBDBD"
          style={styles.categoryArrow}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME vớiグラデーション */}
      <View style={[styles.blueHeader, { backgroundColor: themeColor }]}>
        {/* Decorative circles */}
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <View style={styles.headerDecor3} />

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

        {/* Budget display - Improved */}
        <View style={styles.budgetContainer}>
          <Text style={styles.budgetLabel}>Tổng số dư</Text>
          <View style={styles.budgetAmountWrapper}>
            <Text style={styles.currencySymbol}>₫</Text>
            <Text
              style={[
                styles.budgetAmount,
                { color: totalBalance >= 0 ? "#fff" : "#FFEBEE" },
              ]}
            >
              {formatCurrency(Math.abs(totalBalance))}
            </Text>
          </View>
          {totalBalance < 0 && (
            <View style={styles.warningBadge}>
              <Icon name="alert-circle" size={14} color="#FF5252" />
              <Text style={styles.warningText}>Chi tiêu vượt quá thu nhập</Text>
            </View>
          )}
        </View>

        {/* Expense and Income Cards - Enhanced */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryCardEnhanced]}>
            <View
              style={[styles.summaryIconWrapper, styles.summaryIconEnhanced]}
            >
              <Icon name="arrow-up" size={22} color="#FF5252" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Chi tiêu</Text>
              <Text style={[styles.summaryAmount, { color: "#FF5252" }]}>
                {formatCurrency(totalExpense)} ₫
              </Text>
            </View>
            <View style={styles.summaryTrend}>
              <Icon name="trending-up" size={16} color="#FF5252" />
            </View>
          </View>
          <View
            style={[
              styles.summaryCard,
              styles.summaryCardEnhanced,
              { marginLeft: 12 },
            ]}
          >
            <View
              style={[
                styles.summaryIconWrapper,
                styles.summaryIconEnhanced,
                { backgroundColor: "rgba(76, 175, 80, 0.15)" },
              ]}
            >
              <Icon name="arrow-down" size={22} color="#4CAF50" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Thu nhập</Text>
              <Text style={[styles.summaryAmount, { color: "#4CAF50" }]}>
                {formatCurrency(totalIncome)} ₫
              </Text>
            </View>
            <View
              style={[
                styles.summaryTrend,
                { backgroundColor: "rgba(76, 175, 80, 0.1)" },
              ]}
            >
              <Icon name="trending-down" size={16} color="#4CAF50" />
            </View>
          </View>
        </View>
      </View>

      {/* White section with shadow - Enhanced */}
      <View style={styles.whiteSection}>
        <View style={styles.budgetSettingHeader}>
          <View style={styles.budgetTitleWrapper}>
            <Icon name="wallet-outline" size={20} color={themeColor} />
            <Text style={styles.budgetSettingTitle}>Ngân sách tháng này</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} activeOpacity={0.7}>
            <Icon name="cog-outline" size={18} color={themeColor} />
            <Text style={styles.budgetSettingLink}>Cài đặt</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.budgetBarContainer}>
          <View style={styles.budgetBar}>
            <View
              style={[
                styles.budgetBarFill,
                {
                  width:
                    totalExpense > 0 && totalIncome > 0
                      ? `${Math.min((totalExpense / totalIncome) * 100, 100)}%`
                      : "0%",
                  backgroundColor:
                    totalExpense > 0 &&
                    totalIncome > 0 &&
                    totalExpense / totalIncome > 0.8
                      ? "#FF5252"
                      : totalExpense > 0 &&
                        totalIncome > 0 &&
                        totalExpense / totalIncome > 0.5
                      ? "#FF9800"
                      : "#4CAF50",
                },
              ]}
            />
          </View>
          <View style={styles.budgetInfoRow}>
            <Text style={styles.budgetBarText}>
              {totalExpense > 0 && totalIncome > 0
                ? `Đã chi ${Math.round((totalExpense / totalIncome) * 100)}%`
                : "Chưa có dữ liệu"}
            </Text>
            {totalIncome > 0 && (
              <Text style={styles.budgetRemainingText}>
                Còn lại: {formatCurrency(totalIncome - totalExpense)} ₫
              </Text>
            )}
          </View>
        </View>
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

      {/* Bottom navigation - Enhanced */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Timkiem")}
          activeOpacity={0.7}
        >
          <View style={styles.navIconWrapper}>
            <Icon name="text-box-search-outline" size={24} color="#9E9E9E" />
          </View>
          <Text style={styles.navLabel}>Tìm Kiếm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Home")}
          activeOpacity={0.7}
        >
          <View style={[styles.navIconWrapper, styles.navIconActive]}>
            <Icon name="view-grid-outline" size={24} color={themeColor} />
          </View>
          <Text
            style={[styles.navLabel, { color: themeColor, fontWeight: "600" }]}
          >
            Tổng Quan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Bieudo")}
          activeOpacity={0.7}
        >
          <View style={styles.navIconWrapper}>
            <Icon name="chart-pie" size={24} color="#9E9E9E" />
          </View>
          <Text style={styles.navLabel}>Thống Kê</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Quethoadon")}
        >
          <View style={styles.navIconWrapper}>
            <Icon name="qrcode-scan" size={24} color="#9E9E9E" />
          </View>
          <Text style={styles.navLabel}>Quét hóa đơn</Text>
        </TouchableOpacity>

        {/* FAB button – Enhanced with ripple effect */}
        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: themeColor, shadowColor: themeColor },
          ]}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.9}
        >
          <View style={styles.addButtonInner}>
            <Icon name="plus" size={28} color="#fff" />
          </View>
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
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: "relative",
    overflow: "hidden",
  },
  headerDecor1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    top: -80,
    right: -80,
  },
  headerDecor2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    top: 40,
    left: -50,
  },
  headerDecor3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    bottom: -30,
    right: 50,
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
    position: "relative",
    zIndex: 1,
  },
  budgetLabel: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  budgetAmountWrapper: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "400",
    marginRight: 6,
    opacity: 0.95,
  },
  budgetAmount: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: -1.5,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 82, 82, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  warningText: {
    color: "#FFEBEE",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
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
  summaryCardEnhanced: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryIconEnhanced: {
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  summaryLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "500",
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  summaryTrend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  whiteSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginTop: -12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  budgetSettingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  budgetTitleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  budgetSettingTitle: {
    fontSize: 17,
    color: "#212121",
    fontWeight: "700",
    marginLeft: 8,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  budgetSettingLink: {
    fontSize: 13,
    color: "#1E88E5",
    fontWeight: "600",
  },
  budgetBarContainer: {
    marginTop: 4,
  },
  budgetBar: {
    height: 12,
    backgroundColor: "#E3F2FD",
    borderRadius: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  budgetBarFill: {
    height: "100%",
    width: "0%",
    backgroundColor: "#42A5F5",
    borderRadius: 6,
    shadowColor: "#42A5F5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  budgetInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  budgetBarText: {
    fontSize: 13,
    color: "#757575",
    fontWeight: "600",
  },
  budgetRemainingText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  navIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  navIconActive: {
    backgroundColor: "rgba(33, 150, 243, 0.1)",
  },
  navLabel: {
    fontSize: 11,
    color: "#9E9E9E",
    marginTop: 6,
    fontWeight: "500",
  },
  addButton: {
    // ĐÃ XÓA backgroundColor: '#1E88E5'
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    position: "absolute",
    right: 20,
    bottom: 80,
    borderWidth: 4,
    borderColor: "#fff",
  },
  addButtonInner: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: "#212121",
    fontWeight: "600",
    marginBottom: 4,
  },
  categoryType: {
    fontSize: 12,
    color: "#9E9E9E",
    fontWeight: "500",
  },
  categoryAction: {
    paddingLeft: 8,
  },
  categoryArrow: {
    marginLeft: 0,
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
